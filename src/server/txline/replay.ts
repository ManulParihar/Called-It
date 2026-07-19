// Replays a recorded match from a file so a full game can be shown in a couple
// of minutes without waiting for a live fixture.
//
// The recorded file is JSON Lines: one JSON object per line. Each line has an
// offsetMs, which is how many milliseconds into the match the event happens, and
// the event fields. The lines are already in the MatchEvent shape, so replay
// does not depend on the live feed field names.

import { readFile } from "node:fs/promises";
import { FINISHED_PHASES, VOID_PHASES, isPenaltyPhase } from "../../lib/match";
import type { MatchEvent, MatchEventKind, MatchPhase, TeamSide } from "../../lib/match";

export interface ReplayLine {
  offsetMs: number;
  kind: MatchEventKind;
  team?: TeamSide;
  minute?: number;
  phase?: MatchPhase;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function loadReplayLines(path: string): Promise<ReplayLine[]> {
  const text = await readFile(path, "utf8");
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => JSON.parse(l) as ReplayLine);
  return closeTimeline(lines.sort((a, b) => a.offsetMs - b.offsetMs));
}

// Gives a recording an ending if it stops without one.
//
// The recorded feed does not always run to the final whistle. A tie that goes to
// a shootout is the common case: the last thing recorded is the phase turning to
// awaiting_penalties, and the shootout itself never arrives. Played back as it
// stands, the room sits on "Penalties coming" for good — that phase counts as in
// play, so nothing settles and the match stays live with nothing left to show.
//
// So read the last phase the recording reached and, if the match had not
// finished, close it: penalties_end if it died in the shootout, ended otherwise.
// Recordings that already finished are left alone, and so are the ones that end
// abandoned or called off, since those have their own ending: the stakes go back.
export function closeTimeline(lines: ReplayLine[]): ReplayLine[] {
  let lastPhase: MatchPhase | undefined;
  let lastMinute: number | undefined;
  for (const line of lines) {
    if (line.kind === "phase_change" && line.phase) lastPhase = line.phase;
    if (line.minute !== undefined) lastMinute = line.minute;
  }
  if (!lastPhase) return lines;
  if (FINISHED_PHASES.includes(lastPhase) || VOID_PHASES.includes(lastPhase)) return lines;

  const last = lines[lines.length - 1];
  return [
    ...lines,
    {
      offsetMs: last.offsetMs + 1000,
      kind: "phase_change",
      phase: isPenaltyPhase(lastPhase) ? "penalties_end" : "ended",
      minute: lastMinute,
    },
  ];
}

// Yields the recorded events in order, waiting between them so the match plays
// out over time. A speed of ten plays the match ten times faster than real time.
export async function* replayMatch(
  path: string,
  fixtureId: string,
  speed = 10,
): AsyncGenerator<MatchEvent> {
  const lines = await loadReplayLines(path);
  const pace = speed > 0 ? speed : 1;
  let previousOffset = 0;

  for (const line of lines) {
    const wait = (line.offsetMs - previousOffset) / pace;
    if (wait > 0) await sleep(wait);
    previousOffset = line.offsetMs;

    yield {
      fixtureId,
      kind: line.kind,
      team: line.team,
      minute: line.minute,
      phase: line.phase,
      receivedAt: new Date().toISOString(),
    };
  }
}
