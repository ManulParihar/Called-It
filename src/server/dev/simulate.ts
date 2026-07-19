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
import { loadReplayLines, type ReplayLine } from "../txline/replay";
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

// Loads the recorded timeline for a fixture. A replay pulled by the in app
// refresh button stores its timeline on the row (replay_log), which is the only
// option on a serverless host with a read only filesystem. Falls back to the
// bundled log file, then the sample match, so the Play button always runs.
async function loadTimeline(
  db: ReturnType<typeof serverDb>,
  fixture: Fixture,
): Promise<ReplayLine[]> {
  if (fixture.kind === "replay") {
    const { data } = await db
      .from("fixtures")
      .select("replay_log")
      .eq("id", fixture.id)
      .maybeSingle();
    const log = (data as { replay_log?: unknown[] | null } | null)?.replay_log;
    if (Array.isArray(log) && log.length > 0) {
      return (log as ReplayLine[]).slice().sort((a, b) => a.offsetMs - b.offsetMs);
    }
  }
  return loadReplayLines(logPathFor(fixture));
}

// How far this room has already replayed, which is how many events it has
// recorded itself.
//
// Recorded events and the running match state are stored per fixture, not per
// room, so anything a previous room left behind is still sitting there when a
// new room replays the same match. Left alone that history counts as progress:
// the replay resumes partway in, skipping the early goals, and picks up a state
// that already says full time, so the room settles at nil nil the moment it
// starts. A room with nothing of its own on the fixture is starting from the
// top, so clear the old run first.
async function progressFor(
  db: ReturnType<typeof serverDb>,
  fixtureId: string,
  roomCreatedAt: string,
): Promise<number> {
  const { data: own } = await db
    .from("match_events")
    .select("id")
    .eq("fixture_id", fixtureId)
    .gte("received_at", roomCreatedAt);
  const count = (own as unknown[] | null)?.length ?? 0;
  if (count > 0) return count;

  await db.from("match_events").delete().eq("fixture_id", fixtureId);
  await db.from("match_state").delete().eq("fixture_id", fixtureId);
  return 0;
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

  const lines = await loadTimeline(db, bundle.room.fixture);
  const cursor = await progressFor(db, fixtureId, bundle.room.createdAt);

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
