// Reproduces the create room then lock in flow straight against the server code,
// with the local JSON database. It seeds a fixture, creates a room, reads the
// bundle, submits the five answers, and checks that the player now counts as
// having answered. Run it with: LOCAL_DB=1 tsx scripts/repro-lockin.ts

import { serverDb } from "../src/server/db/supabase";
import { createRoom, getRoomBundle, submitAnswers } from "../src/server/rooms";
import { hasAnswered } from "../src/lib/live";

async function main(): Promise<void> {
  const db = serverDb();
  await db.from("fixtures").upsert(
    {
      id: "fx-sample",
      competition: "World Cup",
      home_team: "Brazil",
      away_team: "Argentina",
      kickoff_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
    { onConflict: "id" },
  );

  const created = await createRoom({
    userId: "u-tester",
    displayName: "Tester",
    mascotId: "jaguar",
    fixtureId: "fx-sample",
    teamA: "home",
    wagerType: "forfeit",
    stakeUsd: 0,
    payoutMode: "winner_takes_all",
    forfeitText: "buys the pizza",
  });
  console.log("created room", created.room.code, "questions:", created.questions.length);

  const bundle = await getRoomBundle(created.room.code);
  if (!bundle) throw new Error("bundle vanished");
  const me = bundle.members[0];

  const answers = bundle.questions.map((q, i) => ({
    questionId: q.id,
    choice: i % 2 === 0 ? ("yes" as const) : ("no" as const),
  }));

  console.log("submitting answers...");
  await submitAnswers(bundle.room.code, { memberId: me.id, answers });
  console.log("submit returned");

  const after = await getRoomBundle(bundle.room.code);
  if (!after) throw new Error("bundle vanished after submit");
  console.log("answers saved:", after.answers.length);
  console.log("hasAnswered:", hasAnswered(after, me.id));
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
