// Reads fixtures that the create screen offers.

import type { Fixture } from "../lib/types";
import { serverDb } from "./db/supabase";
import { toFixture, type FixtureRow } from "./db/mappers";

// Fixtures a room can actually be built on: the live matches and the recorded
// replays. Newest kickoff first, so today's live matches sit above older
// replays. Past kickoffs are kept here on purpose, since a replay is a match
// that has already happened.
export async function getPlayableFixtures(limit = 30): Promise<Fixture[]> {
  const db = serverDb();
  const { data } = await db
    .from("fixtures")
    .select("*")
    .in("kind", ["live", "replay"])
    .order("kickoff_at", { ascending: false })
    .limit(limit);
  return ((data as FixtureRow[]) ?? []).map(toFixture);
}
