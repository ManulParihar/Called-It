// Kickoff closes the room. Once a match is underway nobody may join it and no
// new room may be built around it, so both guards are checked here against the
// local JSON store rather than a hosted database.

import assert from "node:assert/strict";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { test } from "node:test";

// Both must be set before the db module is first imported: the store path is
// read at module load and the client is cached after the first call.
const STORE = ".test-rooms-db.json";
process.env.LOCAL_DB = "1";
process.env.LOCAL_DB_FILE = STORE;

const HOUR = 60 * 60 * 1000;
const future = new Date(Date.now() + 2 * HOUR).toISOString();
const past = new Date(Date.now() - 2 * HOUR).toISOString();

function seed(kickoffAt: string): void {
  writeFileSync(
    STORE,
    JSON.stringify({
      fixtures: [
        {
          id: "fix-1",
          competition: "Test Cup",
          home_team: "Arsenal",
          away_team: "Chelsea",
          kickoff_at: kickoffAt,
        },
      ],
      rooms: [
        {
          id: "room-1",
          code: "TEST01",
          creator_id: "user-1",
          fixture_id: "fix-1",
          team_a: "home",
          wager_type: "forfeit",
          stake_usd: 0,
          payout_mode: "winner_takes_all",
          forfeit_text: "loser buys",
          status: "open",
          pool_address: null,
          created_at: new Date().toISOString(),
          lock_at: kickoffAt,
        },
      ],
      members: [],
      questions: [],
      answers: [],
      match_events: [],
      match_state: [],
      seq: {},
    }),
  );
}

function cleanup(): void {
  if (existsSync(STORE)) rmSync(STORE);
}

const joiner = {
  userId: "user-2",
  displayName: "Late Arrival",
  mascotId: "owl",
};

test("a room cannot be created once the match has kicked off", async () => {
  seed(past);
  const { createRoom } = await import("../src/server/rooms");
  await assert.rejects(
    () =>
      createRoom({
        userId: "user-1",
        displayName: "The Gaffer",
        mascotId: "fox",
        fixtureId: "fix-1",
        teamA: "home",
        wagerType: "forfeit",
        stakeUsd: 0,
        payoutMode: "winner_takes_all",
        forfeitText: "loser buys",
      }),
    /already kicked off/,
  );
  cleanup();
});

test("nobody can join once the match has kicked off", async () => {
  seed(past);
  const { joinRoom } = await import("../src/server/rooms");
  await assert.rejects(() => joinRoom("TEST01", joiner), /match has started/);
  cleanup();
});

test("joining still works before kickoff", async () => {
  seed(future);
  const { joinRoom } = await import("../src/server/rooms");
  const bundle = await joinRoom("TEST01", joiner);
  assert.equal(bundle.members.length, 1);
  assert.equal(bundle.members[0].displayName, "Late Arrival");
  cleanup();
});

test("the room bundle carries the match events and state", async () => {
  seed(future);
  const { getRoomBundle } = await import("../src/server/rooms");
  const bundle = await getRoomBundle("TEST01");
  // Empty, but present: the screens read these instead of waiting on a socket.
  assert.deepEqual(bundle?.events, []);
  assert.equal(bundle?.matchState, null);
  cleanup();
});
