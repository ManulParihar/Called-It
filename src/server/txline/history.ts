// Turns a finished match's recorded score sequence from TxLINE into the JSON
// Lines timeline the replay tools already understand.
//
// The historical endpoint returns the full run of Scores snapshots for one
// fixture. Each snapshot carries the running score, the match phase and, when
// something just happened, an incident. The same moment can repeat across many
// snapshots, so this file folds the sequence down to one line per real event:
// a phase change when the phase moves, a goal when the score goes up, and a card
// or penalty or VAR when an incident first appears.
//
// The feed's exact field names are not fully documented, so every read tries a
// few likely keys and skips anything it cannot understand. That mirrors how
// normalize.ts handles the live stream.

import type { MatchEventKind, MatchPhase, TeamSide } from "../../lib/match";
import { MATCH_PHASE_BY_ID } from "../../lib/match";
import type { ReplayLine } from "./replay";
import { CredentialStore, baseUrl } from "./auth";

type Raw = Record<string, unknown>;

function asRecord(value: unknown): Raw | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Raw)
    : null;
}

function pick(raw: Raw, keys: string[]): unknown {
  for (const key of keys) {
    if (raw[key] !== undefined && raw[key] !== null) return raw[key];
  }
  return undefined;
}

function toNumber(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

// Reads a millisecond timestamp from epoch seconds, epoch millis or an ISO
// string.
function toMs(value: unknown): number | undefined {
  if (typeof value === "number") return value > 1e12 ? value : value * 1000;
  if (typeof value === "string") {
    const t = new Date(value).getTime();
    return Number.isNaN(t) ? undefined : t;
  }
  return undefined;
}

function teamFrom(value: unknown): TeamSide | undefined {
  if (value === 1 || value === "1" || value === "home" || value === "Home") return "home";
  if (value === 2 || value === "2" || value === "away" || value === "Away") return "away";
  return undefined;
}

// A running score, read from whatever shape the feed uses.
interface Score {
  home: number;
  away: number;
}

function readScore(raw: Raw): Score | null {
  const value = pick(raw, ["scoreSoccer", "score", "Score", "ScoreSoccer"]);
  if (value === undefined) return null;

  const obj = asRecord(value);
  if (obj) {
    const home = toNumber(pick(obj, ["home", "Home", "participant1", "Participant1", "p1"]));
    const away = toNumber(pick(obj, ["away", "Away", "participant2", "Participant2", "p2"]));
    if (home !== undefined && away !== undefined) return { home, away };
  }
  if (Array.isArray(value) && value.length >= 2) {
    const home = toNumber(value[0]);
    const away = toNumber(value[1]);
    if (home !== undefined && away !== undefined) return { home, away };
  }
  if (typeof value === "string") {
    const parts = value.split(/[-:]/).map((p) => toNumber(p.trim()));
    if (parts.length >= 2 && parts[0] !== undefined && parts[1] !== undefined) {
      return { home: parts[0], away: parts[1] };
    }
  }
  return null;
}

function readPhase(raw: Raw): MatchPhase | undefined {
  const id = toNumber(
    pick(raw, ["statusSoccerId", "StatusSoccerId", "statusId", "StatusId", "gameState", "GameState", "status"]),
  );
  if (id === undefined) return undefined;
  return MATCH_PHASE_BY_ID[id];
}

function readMinute(raw: Raw): number | undefined {
  return toNumber(pick(raw, ["minute", "Minute", "clock", "Clock", "matchMinute", "MatchMinute"]));
}

const KIND_BY_TYPE: Record<string, MatchEventKind> = {
  goal: "goal",
  yellowcard: "yellow_card",
  yellow: "yellow_card",
  booking: "yellow_card",
  secondyellowcard: "red_card",
  redcard: "red_card",
  red: "red_card",
  sendoff: "red_card",
  corner: "corner",
  cornerkick: "corner",
  penalty: "penalty_awarded",
  penaltyawarded: "penalty_awarded",
  var: "var_review",
  varreview: "var_review",
  substitution: "substitution",
  sub: "substitution",
};

function normalizeType(value: unknown): string | undefined {
  return typeof value === "string" ? value.toLowerCase().replace(/[^a-z]/g, "") : undefined;
}

interface Incident {
  kind: MatchEventKind;
  team?: TeamSide;
}

// Reads an incident off a snapshot's action, if it carries one we care about.
function readIncident(raw: Raw): Incident | null {
  const action = asRecord(pick(raw, ["action", "Action", "incident", "Incident"]));
  if (!action) return null;

  const typeText = normalizeType(pick(action, ["type", "Type", "kind", "Kind", "name", "Name"]));
  let kind = typeText ? KIND_BY_TYPE[typeText] : undefined;

  // A VAR action names what it reviewed under Data.Type; a red card there still
  // counts as a red card for us.
  if (kind === "var_review") {
    const data = asRecord(pick(action, ["data", "Data"]));
    const reviewed = data ? normalizeType(pick(data, ["type", "Type"])) : undefined;
    if (reviewed && KIND_BY_TYPE[reviewed] && KIND_BY_TYPE[reviewed] !== "var_review") {
      kind = "var_review";
    }
  }
  if (!kind) return null;

  const team = teamFrom(pick(action, ["participant", "Participant", "team", "Team", "side", "Side"]))
    ?? teamFrom(pick(raw, ["participant", "Participant"]));
  return { kind, team };
}

// Folds an ordered run of snapshots into one line per real event.
export function scoresToReplayLines(scores: unknown[]): ReplayLine[] {
  const rows = scores
    .map(asRecord)
    .filter((r): r is Raw => r !== null)
    .sort((a, b) => (toNumber(pick(a, ["seq", "Seq"])) ?? 0) - (toNumber(pick(b, ["seq", "Seq"])) ?? 0));

  const lines: ReplayLine[] = [];
  let baseMs: number | undefined;
  let lastPhase: MatchPhase | undefined;
  let lastScore: Score = { home: 0, away: 0 };
  const seenIncident = new Set<number>();

  for (const row of rows) {
    const ms = toMs(pick(row, ["ts", "Ts", "timestamp", "Timestamp"]));
    if (baseMs === undefined && ms !== undefined) baseMs = ms;
    const offsetMs = ms !== undefined && baseMs !== undefined ? Math.max(0, ms - baseMs) : lines.length * 1000;
    const minute = readMinute(row);

    const phase = readPhase(row);
    if (phase && phase !== lastPhase) {
      lines.push({ offsetMs, kind: "phase_change", phase, minute });
      lastPhase = phase;
    }

    const score = readScore(row);
    if (score) {
      if (score.home > lastScore.home) lines.push({ offsetMs, kind: "goal", team: "home", minute });
      if (score.away > lastScore.away) lines.push({ offsetMs, kind: "goal", team: "away", minute });
      lastScore = score;
    }

    const incident = readIncident(row);
    const seq = toNumber(pick(row, ["seq", "Seq"]));
    if (incident && seq !== undefined && !seenIncident.has(seq)) {
      seenIncident.add(seq);
      lines.push({ offsetMs, kind: incident.kind, team: incident.team, minute });
    }
  }

  return lines.sort((a, b) => a.offsetMs - b.offsetMs);
}

// Fetches the full recorded score sequence for one finished fixture.
export async function fetchHistorical(
  store: CredentialStore,
  fixtureId: string | number,
): Promise<unknown[]> {
  const url = `${baseUrl()}/api/scores/historical/${fixtureId}`;
  let creds = await store.current();
  let res = await fetch(url, {
    headers: { ...store.authHeaders(creds), Accept: "application/json" },
  });
  if (res.status === 401) {
    creds = await store.refresh();
    res = await fetch(url, {
      headers: { ...store.authHeaders(creds), Accept: "application/json" },
    });
  }
  if (!res.ok) throw new Error(`Historical request for ${fixtureId} failed with status ${res.status}`);
  const body = (await res.json()) as unknown;
  if (Array.isArray(body)) return body;
  const obj = asRecord(body);
  const list = obj ? pick(obj, ["scores", "Scores", "data"]) : undefined;
  return Array.isArray(list) ? list : [];
}
