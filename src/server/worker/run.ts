// Entry point for the match worker.
//
// Two modes, chosen with the TXLINE_REPLAY environment variable:
//
//   Replay mode: plays a recorded match file through the pipeline at a chosen
//   speed. Used for demos and for testing without a live game.
//
//   Live mode: opens the TxLINE scores stream and processes events for any
//   fixture that has an active room.
//
// Run it with: npm run worker

import { loadEnv } from "../env";
import type { MatchState } from "../../lib/match";
import { serverDb } from "../db/supabase";
import { baseUrl, CredentialStore } from "../txline/auth";
import { streamScores } from "../txline/client";
import { replayMatch } from "../txline/replay";
import { loadState, processEvent } from "./pipeline";

async function runReplay(): Promise<void> {
  const db = serverDb();
  const fixtureId = process.env.REPLAY_FIXTURE_ID;
  const logPath = process.env.REPLAY_LOG || "data/sample-match.jsonl";
  const speed = Number(process.env.TXLINE_REPLAY_SPEED || "10");

  if (!fixtureId) {
    throw new Error("Set REPLAY_FIXTURE_ID to the fixture you are replaying.");
  }

  console.log(`[worker] replaying ${logPath} for fixture ${fixtureId} at ${speed}x`);
  let state = await loadState(db, fixtureId);

  for await (const event of replayMatch(logPath, fixtureId, speed)) {
    state = await processEvent(db, state, event);
    const min = event.minute != null ? `${event.minute}'` : "";
    console.log(`[worker] ${event.kind} ${event.team ?? ""} ${min}`.trim());
  }

  console.log("[worker] replay finished");
}

async function runLive(): Promise<void> {
  const db = serverDb();
  const store = new CredentialStore();

  // Keep a small cache of state per fixture and the set of fixtures we care
  // about. The active set is refreshed on a timer.
  const states = new Map<string, MatchState>();
  let active = await loadActiveFixtures(db);
  setInterval(async () => {
    active = await loadActiveFixtures(db);
  }, 30_000);

  console.log("[worker] live mode started");

  for await (const event of streamScores({
    store,
    baseUrl: baseUrl(),
    shouldInclude: (id) => active.has(id),
  })) {
    const current = states.get(event.fixtureId) ?? (await loadState(db, event.fixtureId));
    const next = await processEvent(db, current, event);
    states.set(event.fixtureId, next);
  }
}

async function loadActiveFixtures(db: ReturnType<typeof serverDb>): Promise<Set<string>> {
  const { data } = await db
    .from("rooms")
    .select("fixture_id")
    .in("status", ["open", "locked", "live"]);
  return new Set(((data as { fixture_id: string }[]) ?? []).map((r) => r.fixture_id));
}

async function main(): Promise<void> {
  loadEnv();
  const replay = (process.env.TXLINE_REPLAY || "false").toLowerCase() === "true";
  if (replay) {
    await runReplay();
  } else {
    await runLive();
  }
}

main().catch((err) => {
  console.error("[worker] fatal error", err);
  process.exit(1);
});
