// Pulls the last few finished World Cup matches from TxLINE and writes them as
// recorded timelines the app can replay for testing.
//
// The feed work lives in src/server/txline/pull.ts, shared with the in app
// refresh button. This script takes the pulled timelines and writes each one to
// data/replays/<id>.jsonl, plus data/replays/index.json with the fixture
// metadata so the seed can insert these as replay fixtures locally.
//
// Run it with: npm run pull:replays
// It needs TXLINE_API_TOKEN in the environment. Without it, or if the feed is
// unreachable, it exits with a message and the app keeps using the built in
// sample match for replays.

import { mkdirSync, writeFileSync } from "node:fs";
import { loadEnv } from "../src/server/env";
import { pullRecentReplays, type ReplayMeta } from "../src/server/txline/pull";
import type { ReplayLine } from "../src/server/txline/replay";

const REPLAY_DIR = "data/replays";

function writeLog(txFixtureId: string, lines: ReplayLine[]): void {
  const body = lines.map((l) => JSON.stringify(l)).join("\n") + "\n";
  writeFileSync(`${REPLAY_DIR}/${txFixtureId}.jsonl`, body);
}

async function main(): Promise<void> {
  loadEnv();

  mkdirSync(REPLAY_DIR, { recursive: true });

  let pulled;
  try {
    pulled = await pullRecentReplays({ log: (m) => console.log(m) });
  } catch (err) {
    console.error((err as Error).message);
    console.error("Set TXLINE_API_TOKEN to pull real replays. Skipping.");
    process.exit(1);
  }

  const saved: ReplayMeta[] = [];
  for (const { meta, lines } of pulled) {
    writeLog(meta.txFixtureId, lines);
    saved.push(meta);
    console.log(`  saved -> ${REPLAY_DIR}/${meta.txFixtureId}.jsonl`);
  }

  writeFileSync(`${REPLAY_DIR}/index.json`, JSON.stringify(saved, null, 2) + "\n");
  console.log(`Wrote ${saved.length} replays and ${REPLAY_DIR}/index.json.`);
  if (saved.length === 0) {
    console.log("No replays pulled. The app will fall back to the sample match.");
  }
}

main().catch((err) => {
  console.error("Pull failed", err);
  process.exit(1);
});
