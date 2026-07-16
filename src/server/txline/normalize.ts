// Turns a raw score message from the feed into our own MatchEvent shape.
//
// The feed sends team level data: a match phase (as a number) and a list of
// incidents such as goals and cards, each tagged with the team it belongs to.
// This file is the one adapter between the feed and the rest of the app. If the
// live payload uses different field names than the ones tried below, this is the
// only place that needs to change.
//
// The recorded match logs used for demos are already in the MatchEvent shape, so
// they do not go through this adapter. That keeps the demo path independent of
// the exact feed field names.

import {
  MATCH_PHASE_BY_ID,
  type MatchEvent,
  type MatchEventKind,
  type MatchPhase,
  type TeamSide,
} from "../../lib/match";

type Raw = Record<string, unknown>;

function asRecord(value: unknown): Raw | null {
  return value && typeof value === "object" ? (value as Raw) : null;
}

// Reads the first key that is present from a list of possible names.
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

function readPhase(raw: Raw): MatchPhase | undefined {
  const id = toNumber(pick(raw, ["Status", "StatusId", "MatchStatus", "GamePhase", "Phase"]));
  if (id === undefined) return undefined;
  return MATCH_PHASE_BY_ID[id];
}

function readTeam(inc: Raw): TeamSide | undefined {
  const value = pick(inc, ["Participant", "ParticipantId", "Team", "Side"]);
  if (value === 1 || value === "1" || value === "home" || value === "Home") return "home";
  if (value === 2 || value === "2" || value === "away" || value === "Away") return "away";
  return undefined;
}

function readMinute(inc: Raw): number | undefined {
  return toNumber(pick(inc, ["Minute", "Time", "Clock", "MatchMinute"]));
}

// Maps a feed incident type onto one of our event kinds.
const KIND_BY_TYPE: Record<string, MatchEventKind> = {
  goal: "goal",
  yellowcard: "yellow_card",
  yellow: "yellow_card",
  redcard: "red_card",
  red: "red_card",
  corner: "corner",
  cornerkick: "corner",
  penalty: "penalty_awarded",
  penaltyawarded: "penalty_awarded",
  var: "var_review",
  varreview: "var_review",
  substitution: "substitution",
  sub: "substitution",
};

function readKind(inc: Raw): MatchEventKind | undefined {
  const type = pick(inc, ["Type", "IncidentType", "Kind", "Action"]);
  if (typeof type !== "string") return undefined;
  return KIND_BY_TYPE[type.toLowerCase().replace(/[^a-z]/g, "")];
}

function readIncidents(raw: Raw): Raw[] {
  const list = pick(raw, ["Incidents", "Events", "Actions"]);
  if (!Array.isArray(list)) return [];
  return list.map(asRecord).filter((r): r is Raw => r !== null);
}

// Builds the list of events contained in one raw score message.
export function normalizeScoresData(
  data: unknown,
  fixtureId: string,
  receivedAt: string,
): MatchEvent[] {
  const raw = asRecord(data);
  if (!raw) return [];

  const seq = toNumber(pick(raw, ["Seq", "seq", "Sequence"]));
  const events: MatchEvent[] = [];

  const phase = readPhase(raw);
  if (phase) {
    events.push({ fixtureId, kind: "phase_change", phase, seq, receivedAt });
  }

  for (const inc of readIncidents(raw)) {
    const kind = readKind(inc);
    if (!kind) continue;
    events.push({
      fixtureId,
      kind,
      team: readTeam(inc),
      minute: readMinute(inc),
      seq,
      receivedAt,
    });
  }

  return events;
}
