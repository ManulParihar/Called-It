// Drives a room all the way through with the testing simulate helper, against
// the local JSON database. Seeds a fixture, creates a money room, answers,
// plays a few events, then ends the game and prints the final room status.
// Run it with: LOCAL_DB=1 npx tsx scripts/repro-simulate.ts

import { serverDb } from "../src/server/db/supabase";
import { createRoom, getRoomBundle, submitAnswers } from "../src/server/rooms";
import { simulateRoom } from "../src/server/dev/simulate";

async function main(): Promise<void> {
  const db = serverDb();
  await db.from("fixtures").upsert(
    {
      id: "fx-sim",
      competition: "World Cup",
      home_team: "Brazil",
      away_team: "Argentina",
      kickoff_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
    { onConflict: "id" },
  );

  const created = await createRoom({
    userId: "u-sim",
    displayName: "Sim Tester",
    mascotId: "jaguar",
    fixtureId: "fx-sim",
    teamA: "home",
    wagerType: "money",
    stakeUsd: 20,
    payoutMode: "winner_takes_all",
    forfeitText: null,
  });
  const code = created.room.code;
  const me = created.members[0];

  const answers = created.questions.map((q, i) => ({
    questionId: q.id,
    choice: i % 2 === 0 ? ("yes" as const) : ("no" as const),
  }));
  await submitAnswers(code, { memberId: me.id, answers });

  const step1 = await simulateRoom(code, { steps: 4 });
  console.log("after play:", step1);

  const step2 = await simulateRoom(code, { toEnd: true });
  console.log("after end:", step2);

  const final = await getRoomBundle(code);
  console.log("final status:", final?.room.status);
  console.log(
    "resolved questions:",
    final?.questions.filter((q) => q.outcome !== "pending").length,
    "of",
    final?.questions.length,
  );
}

main()
  .then(() => {
    console.log("OK");
    process.exit(0);
  })
  .catch((err) => {
    console.error("FAILED", err);
    process.exit(1);
  });
