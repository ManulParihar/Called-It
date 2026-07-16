// Inserts a few fixtures so rooms can be created during local testing.
//
// The fixture with id "fx-sample" matches the recorded match file, so you can
// create a room on it and then run the worker in replay mode with
// REPLAY_FIXTURE_ID=fx-sample to watch the room come to life.
//
// Run it with: npm run seed

import { loadEnv } from "../src/server/env";
import { serverDb } from "../src/server/db/supabase";

function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
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
    },
    {
      id: "fx-demo-2",
      competition: "World Cup",
      home_team: "France",
      away_team: "England",
      kickoff_at: hoursFromNow(3),
    },
  ];

  const { error } = await db.from("fixtures").upsert(fixtures, { onConflict: "id" });
  if (error) throw error;

  console.log(`Seeded ${fixtures.length} fixtures.`);
}

main().catch((err) => {
  console.error("Seed failed", err);
  process.exit(1);
});
