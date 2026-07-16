// Replays a recorded match from a file so a full game can be shown in a couple
// of minutes without waiting for a live fixture.
//
// The recorded file is JSON Lines: one JSON object per line. Each line has an
// offsetMs, which is how many milliseconds into the match the event happens, and
// the event fields. The lines are already in the MatchEvent shape, so replay
// does not depend on the live feed field names.

import { readFile } from "node:fs/promises";
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
  return lines.sort((a, b) => a.offsetMs - b.offsetMs);
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
