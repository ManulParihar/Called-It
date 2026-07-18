// Inserts the replay fixtures so rooms can be created during local testing.
// Live and upcoming matches are pulled live from the TxLINE feed, so they are
// not seeded here.
//
// The "tx-sample-replay" fixture falls back to the bundled recorded match, so
// you can create a room on it and drive it forward with the settings menu's
// Play button even with no feed access.
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
    // Live and upcoming matches come straight from the TxLINE feed now, so the
    // database only seeds replays. A replay that always works, even with no feed
    // access: it has no pulled timeline, so the Play button falls back to the
    // recorded sample match.
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
