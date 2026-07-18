// Reads fixtures that the create screen offers.

import type { Fixture } from "../lib/types";
import { serverDb } from "./db/supabase";
import { toFixture, type FixtureRow } from "./db/mappers";

// Recorded replays a room can be built and played on, newest kickoff first.
// Live and upcoming matches come straight from the TxLINE feed instead (see
// getTxlineFixtures); only replays live in the database now.
export async function getReplayFixtures(limit = 30): Promise<Fixture[]> {
  const db = serverDb();
  const { data } = await db
    .from("fixtures")
    .select("*")
    .eq("kind", "replay")
    .order("kickoff_at", { ascending: false })
    .limit(limit);
  return ((data as FixtureRow[]) ?? []).map(toFixture);
}
