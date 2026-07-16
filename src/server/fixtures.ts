// Reads fixtures that a room can be built around.

import type { Fixture } from "../lib/types";
import { serverDb } from "./db/supabase";
import { toFixture, type FixtureRow } from "./db/mappers";

// Upcoming fixtures, soonest first. Past kickoffs are left out so the create
// screen only offers matches that can still be played.
export async function getUpcomingFixtures(limit = 20): Promise<Fixture[]> {
  const db = serverDb();
  const { data } = await db
    .from("fixtures")
    .select("*")
    .gte("kickoff_at", new Date().toISOString())
    .order("kickoff_at", { ascending: true })
    .limit(limit);
  return ((data as FixtureRow[]) ?? []).map(toFixture);
}
