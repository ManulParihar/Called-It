// Inserts a few fixtures so rooms can be created during local testing.
//
// The fixture with id "fx-sample" matches the recorded match file, so you can
// create a room on it and then run the worker in replay mode with
// REPLAY_FIXTURE_ID=fx-sample to watch the room come to life.
//
// Run it with: npm run seed

import { existsSync, readFileSync } from "node:fs";
import { loadEnv } from "../src/server/env";
import { serverDb } from "../src/server/db/supabase";

const REPLAY_INDEX = "data/replays/index.json";

function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

interface ReplayMeta {
  id: string;
  txFixtureId: string;
  competition: string;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: string;
}

// Replay fixtures written by npm run pull:replays, if that has been run. Each
// one has its own recorded timeline under data/replays.
function pulledReplays(): Array<Record<string, unknown>> {
  if (!existsSync(REPLAY_INDEX)) return [];
  try {
    const list = JSON.parse(readFileSync(REPLAY_INDEX, "utf8")) as ReplayMeta[];
    return list.map((m) => ({
      id: m.id,
      competition: m.competition,
      home_team: m.homeTeam,
      away_team: m.awayTeam,
      kickoff_at: m.kickoffAt,
      kind: "replay",
      tx_fixture_id: m.txFixtureId,
    }));
  } catch {
    return [];
  }
}

async function main(): Promise<void> {
  loadEnv();
  const db = serverDb();

  const fixtures = [
    {
      id: "fx-sample",
      competition: "World Cup",
      home_team: "Brazil",
      away_team: "Argentina",
      kickoff_at: hoursFromNow(1),
      kind: "live",
    },
    {
      id: "fx-demo-2",
      competition: "World Cup",
      home_team: "France",
      away_team: "England",
      kickoff_at: hoursFromNow(3),
      kind: "live",
    },
    // A replay that always works, even with no feed access: it has no pulled
    // timeline, so the Play button falls back to the recorded sample match.
    {
      id: "tx-sample-replay",
      competition: "World Cup",
      home_team: "Brazil",
      away_team: "Argentina",
      kickoff_at: hoursFromNow(-48),
      kind: "replay",
      tx_fixture_id: "sample-replay",
    },
    ...pulledReplays(),
  ];

  const { error } = await db.from("fixtures").upsert(fixtures, { onConflict: "id" });
  if (error) throw error;

  console.log(`Seeded ${fixtures.length} fixtures.`);
}

main().catch((err) => {
  console.error("Seed failed", err);
  process.exit(1);
});
