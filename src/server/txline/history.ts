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
import { readSseMessages } from "./sse";

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

// The running tallies the feed keeps for one team. Every snapshot carries the
// full set, so a real event shows up as one of these counters going up.
interface Tally {
  goals: number;
  yellowCards: number;
  redCards: number;
  corners: number;
}

const EMPTY_TALLY: Tally = { goals: 0, yellowCards: 0, redCards: 0, corners: 0 };

// Reads one team's running totals. The feed nests them as
// Score.Participant1.Total.{Goals,YellowCards,RedCards,Corners}, and leaves a
// counter out entirely while it is still zero.
function readTally(raw: Raw, participant: 1 | 2): Tally | null {
  const score = asRecord(pick(raw, ["Score", "score"]));
  if (!score) return null;
  const side = asRecord(pick(score, [`Participant${participant}`, `participant${participant}`]));
  if (!side) return null;
  const total = asRecord(pick(side, ["Total", "total"]));
  if (!total) return EMPTY_TALLY;
  return {
    goals: toNumber(pick(total, ["Goals", "goals"])) ?? 0,
    yellowCards: toNumber(pick(total, ["YellowCards", "yellowCards"])) ?? 0,
    redCards: toNumber(pick(total, ["RedCards", "redCards"])) ?? 0,
    corners: toNumber(pick(total, ["Corners", "corners"])) ?? 0,
  };
}

// Which participant is the home team. The feed says so on every snapshot and
// defaults to participant one.
function homeParticipant(raw: Raw): 1 | 2 {
  return pick(raw, ["Participant1IsHome", "participant1IsHome"]) === false ? 2 : 1;
}

function readPhase(raw: Raw): MatchPhase | undefined {
  const id = toNumber(
    pick(raw, ["StatusId", "statusId", "statusSoccerId", "StatusSoccerId"]),
  );
  if (id === undefined) return undefined;
  return MATCH_PHASE_BY_ID[id];
}

// The match minute, taken from the running clock the feed sends in seconds. The
// clock keeps counting across half time, so the second half reads 46 and up.
function readMinute(raw: Raw): number | undefined {
  const clock = asRecord(pick(raw, ["Clock", "clock"]));
  const seconds = clock ? toNumber(pick(clock, ["Seconds", "seconds"])) : undefined;
  if (seconds === undefined) return undefined;
  return Math.floor(seconds / 60) + 1;
}

// Actions the feed names but does not keep a counter for. Goals, cards and
// corners are read off the running totals instead, since those survive an
// action being discarded or amended later.
const KIND_BY_ACTION: Record<string, MatchEventKind> = {
  penalty: "penalty_awarded",
  penaltyawarded: "penalty_awarded",
  penaltyshot: "penalty_awarded",
  var: "var_review",
  varreview: "var_review",
  varcheck: "var_review",
  substitution: "substitution",
  sub: "substitution",
};

function normalizeType(value: unknown): string | undefined {
  return typeof value === "string" ? value.toLowerCase().replace(/[^a-z]/g, "") : undefined;
}

// The snapshot's Action is a plain string, such as "goal" or "substitution".
function readAction(raw: Raw): string | undefined {
  return normalizeType(pick(raw, ["Action", "action"]));
}

// Which team a snapshot's action belongs to, given which participant is home.
function actionTeam(raw: Raw, home: 1 | 2): TeamSide | undefined {
  const participant = toNumber(pick(raw, ["Participant", "participant"]));
  if (participant !== 1 && participant !== 2) return undefined;
  return participant === home ? "home" : "away";
}

// The counters we turn into events, paired with the kind each one stands for.
const TALLY_KINDS: [keyof Tally, MatchEventKind][] = [
  ["goals", "goal"],
  ["yellowCards", "yellow_card"],
  ["redCards", "red_card"],
  ["corners", "corner"],
];

// Removes the most recent line of a kind for a team, for when the feed takes an
// event back.
function retract(lines: ReplayLine[], kind: MatchEventKind, team: TeamSide): void {
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (lines[i].kind === kind && lines[i].team === team) {
      lines.splice(i, 1);
      return;
    }
  }
}

// Folds an ordered run of snapshots into one line per real event.
export function scoresToReplayLines(scores: unknown[]): ReplayLine[] {
  const rows = scores
    .map(asRecord)
    .filter((r): r is Raw => r !== null)
    .sort((a, b) => (toNumber(pick(a, ["Seq", "seq"])) ?? 0) - (toNumber(pick(b, ["Seq", "seq"])) ?? 0));

  // Time the replay from kickoff. The recorded sequence starts days earlier with
  // coverage and lineup messages, so the first snapshot is no use as a base.
  const kickoff = rows.find((r) => readPhase(r) === "first_half");
  const baseMs =
    toMs(pick(kickoff ?? rows[0] ?? {}, ["Ts", "ts", "timestamp", "Timestamp"])) ?? undefined;

  const lines: ReplayLine[] = [];
  let lastPhase: MatchPhase | undefined;
  const previous: Record<1 | 2, Tally> = { 1: EMPTY_TALLY, 2: EMPTY_TALLY };
  const seenAction = new Set<number>();

  for (const row of rows) {
    const ms = toMs(pick(row, ["Ts", "ts", "timestamp", "Timestamp"]));
    const offsetMs =
      ms !== undefined && baseMs !== undefined ? Math.max(0, ms - baseMs) : lines.length * 1000;
    const minute = readMinute(row);
    const home = homeParticipant(row);

    const phase = readPhase(row);
    if (phase && phase !== lastPhase) {
      lines.push({ offsetMs, kind: "phase_change", phase, minute });
      lastPhase = phase;
    }

    // One line per step a counter takes, so a snapshot that jumps two goals ahead
    // still reads out as two goals. A counter that falls means the feed took an
    // event back, which is how a disallowed goal arrives, so drop the lines it
    // already produced instead of scoring it twice when it is given again.
    for (const participant of [1, 2] as const) {
      const tally = readTally(row, participant);
      if (!tally) continue;
      const team: TeamSide = participant === home ? "home" : "away";
      for (const [field, kind] of TALLY_KINDS) {
        for (let n = previous[participant][field]; n < tally[field]; n += 1) {
          lines.push({ offsetMs, kind, team, minute });
        }
        for (let n = previous[participant][field]; n > tally[field]; n -= 1) {
          retract(lines, kind, team);
        }
      }
      previous[participant] = tally;
    }

    const action = readAction(row);
    const kind = action ? KIND_BY_ACTION[action] : undefined;
    const seq = toNumber(pick(row, ["Seq", "seq"]));
    if (kind && seq !== undefined && !seenAction.has(seq)) {
      seenAction.add(seq);
      lines.push({ offsetMs, kind, team: actionTeam(row, home), minute });
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
    headers: { ...store.authHeaders(creds), Accept: "text/event-stream" },
  });
  if (res.status === 401) {
    creds = await store.refresh();
    res = await fetch(url, {
      headers: { ...store.authHeaders(creds), Accept: "text/event-stream" },
    });
  }
  if (!res.ok) throw new Error(`Historical request for ${fixtureId} failed with status ${res.status}`);

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("text/event-stream")) {
    const body = (await res.json()) as unknown;
    if (Array.isArray(body)) return body;
    const obj = asRecord(body);
    const list = obj ? pick(obj, ["scores", "Scores", "data"]) : undefined;
    return Array.isArray(list) ? list : [];
  }

  const scores: unknown[] = [];
  for await (const message of readSseMessages(res)) {
    if (!message.data) continue;
    try {
      scores.push(JSON.parse(message.data));
    } catch {
      continue;
    }
  }
  return scores;
}
