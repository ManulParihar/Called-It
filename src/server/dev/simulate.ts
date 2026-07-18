// Testing helpers that push a room through a match without a live feed or the
// worker process. They replay the recorded sample match straight through the
// same pipeline the worker uses, so what you see on screen is the real thing:
// questions resolve, the room goes live, and full time settles the pot or reads
// out the forfeit.
//
// These are only meant for local testing and are gated to non production builds
// by devToolsEnabled and by the route that calls them.

import { existsSync } from "node:fs";
import { serverDb } from "../db/supabase";
import { getRoomBundle } from "../rooms";
import { loadReplayLines } from "../txline/replay";
import { loadState, processEvent } from "../worker/pipeline";
import type { MatchEvent } from "../../lib/match";
import type { Fixture } from "../../lib/types";

const SAMPLE_LOG = "data/sample-match.jsonl";

// The testing tools should never be reachable in a real deployment. The one
// exception is a hackathon/judge deployment, where nobody can rely on a real
// match being live: NEXT_PUBLIC_ENABLE_DEV_TOOLS opts a specific hosted build
// into exposing them anyway.
export function devToolsEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS === "1"
  );
}

// Picks the recorded timeline to replay for a fixture. A replay fixture pulled
// from the feed has its own log under data/replays; anything else, or a replay
// whose log has not been pulled yet, falls back to the built in sample match so
// the Play button always has something to run.
function logPathFor(fixture: Fixture): string {
  if (fixture.kind === "replay" && fixture.txFixtureId) {
    const path = `data/replays/${fixture.txFixtureId}.jsonl`;
    if (existsSync(path)) return path;
  }
  return SAMPLE_LOG;
}

export interface SimulateResult {
  processed: number;
  remaining: number;
  done: boolean;
  phase: string;
  status: string;
}

// Advances a room by replaying the next slice of the recorded match. Pass
// toEnd to run everything that is left in one go, otherwise it plays `steps`
// events. The cursor is simply how many events the fixture has already stored,
// so repeated calls pick up where the last one stopped.
export async function simulateRoom(
  code: string,
  options: { steps?: number; toEnd?: boolean } = {},
): Promise<SimulateResult> {
  const db = serverDb();

  const bundle = await getRoomBundle(code);
  if (!bundle) throw new Error("Room not found");
  const fixtureId = bundle.room.fixture.id;

  const lines = await loadReplayLines(logPathFor(bundle.room.fixture));

  const { data: existing } = await db
    .from("match_events")
    .select("id")
    .eq("fixture_id", fixtureId);
  const cursor = (existing as unknown[] | null)?.length ?? 0;

  const steps = options.toEnd ? lines.length : Math.max(1, options.steps ?? 3);
  const slice = lines.slice(cursor, cursor + steps);

  let state = await loadState(db, fixtureId);
  for (const line of slice) {
    const event: MatchEvent = {
      fixtureId,
      kind: line.kind,
      team: line.team,
      minute: line.minute,
      phase: line.phase,
      receivedAt: new Date().toISOString(),
    };
    state = await processEvent(db, state, event);
  }

  const consumed = cursor + slice.length;
  const after = await getRoomBundle(code);

  return {
    processed: slice.length,
    remaining: Math.max(0, lines.length - consumed),
    done: consumed >= lines.length,
    phase: state.phase,
    status: after?.room.status ?? bundle.room.status,
  };
}
