import assert from "node:assert/strict";
import { test } from "node:test";
import { initialMatchState, matchWinner, type MatchEvent } from "../src/lib/match";
import { applyEvents } from "../src/lib/match-reducer";
import { loadReplayLines } from "../src/server/txline/replay";
import { TEMPLATES_BY_ID } from "../src/lib/questions/bank";

// Folds the sample match file into a final state, without any timing waits.
async function finalStateFromSample() {
  const lines = await loadReplayLines("data/sample-match.jsonl");
  const events: MatchEvent[] = lines.map((line) => ({
    fixtureId: "fx-sample",
    kind: line.kind,
    team: line.team,
    minute: line.minute,
    phase: line.phase,
    receivedAt: "2026-07-16T02:00:00.000Z",
  }));
  return applyEvents(initialMatchState("fx-sample"), events);
}

test("the sample match ends three to two to the home side", async () => {
  const state = await finalStateFromSample();
  assert.equal(state.phase, "ended");
  assert.equal(state.goals.home, 3);
  assert.equal(state.goals.away, 2);
  assert.equal(matchWinner(state), "home");
});

test("the sample match resolves a lively spread of questions", async () => {
  const state = await finalStateFromSample();
  const check = (id: string, team: "home" | "away" | null, expected: string) =>
    assert.equal(TEMPLATES_BY_ID[id].evaluate(state, team), expected, id);

  check("headline_team_win", "home", "yes");
  check("over_2_5_goals", null, "yes");
  check("both_teams_score", null, "yes");
  check("team_scores_first", "home", "yes");
  check("level_at_half_time", null, "yes");
  check("red_card_shown", null, "yes");
  check("penalty_awarded", null, "yes");
  check("var_review", null, "yes");
  check("goal_after_ninety", null, "yes");
  check("four_yellow_cards", null, "no");
  check("over_9_5_corners", null, "no");
});
