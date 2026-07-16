import assert from "node:assert/strict";
import { test } from "node:test";
import { initialMatchState, matchWinner, type MatchEvent } from "../src/lib/match";
import { applyEvents } from "../src/lib/match-reducer";
import { TEMPLATES_BY_ID } from "../src/lib/questions/bank";

function ev(partial: Partial<MatchEvent> & { kind: MatchEvent["kind"] }): MatchEvent {
  return {
    fixtureId: "fx-1",
    receivedAt: "2026-07-16T02:00:00.000Z",
    ...partial,
  };
}

test("goals and phases build up the score line", () => {
  let state = initialMatchState("fx-1");
  state = applyEvents(state, [
    ev({ kind: "phase_change", phase: "first_half" }),
    ev({ kind: "goal", team: "home", minute: 10 }),
    ev({ kind: "phase_change", phase: "half_time" }),
    ev({ kind: "goal", team: "away", minute: 70 }),
    ev({ kind: "phase_change", phase: "second_half" }),
    ev({ kind: "goal", team: "home", minute: 80 }),
    ev({ kind: "phase_change", phase: "ended" }),
  ]);

  assert.equal(state.goals.home, 2);
  assert.equal(state.goals.away, 1);
  assert.equal(state.firstGoalTeam, "home");
  assert.equal(state.goalInFirstFifteen, true);
  assert.deepEqual(state.halfTimeScore, { home: 1, away: 0 });
  assert.equal(matchWinner(state), "home");
});

test("a shootout decides the tie without changing the score line", () => {
  let state = initialMatchState("fx-1");
  state = applyEvents(state, [
    ev({ kind: "phase_change", phase: "first_half" }),
    ev({ kind: "goal", team: "home", minute: 20 }),
    ev({ kind: "goal", team: "away", minute: 60 }),
    ev({ kind: "phase_change", phase: "penalties" }),
    ev({ kind: "goal", team: "away" }),
    ev({ kind: "goal", team: "away" }),
    ev({ kind: "goal", team: "home" }),
    ev({ kind: "phase_change", phase: "penalties_end" }),
  ]);

  assert.equal(state.goals.home, 1);
  assert.equal(state.goals.away, 1);
  assert.deepEqual(state.shootoutGoals, { home: 1, away: 2 });
  assert.equal(matchWinner(state), "away");
});

test("questions resolve from the final state", () => {
  let state = initialMatchState("fx-1");
  state = applyEvents(state, [
    ev({ kind: "phase_change", phase: "first_half" }),
    ev({ kind: "goal", team: "home", minute: 10 }),
    ev({ kind: "yellow_card", team: "away", minute: 25 }),
    ev({ kind: "goal", team: "away", minute: 55 }),
    ev({ kind: "goal", team: "home", minute: 65 }),
    ev({ kind: "phase_change", phase: "ended" }),
  ]);

  // Three goals in total, so more than two goals is yes.
  assert.equal(TEMPLATES_BY_ID["over_2_5_goals"].evaluate(state, null), "yes");
  // Both teams scored.
  assert.equal(TEMPLATES_BY_ID["both_teams_score"].evaluate(state, null), "yes");
  // Home scored first.
  assert.equal(TEMPLATES_BY_ID["team_scores_first"].evaluate(state, "home"), "yes");
  assert.equal(TEMPLATES_BY_ID["team_scores_first"].evaluate(state, "away"), "no");
  // Away got the first card.
  assert.equal(TEMPLATES_BY_ID["team_first_card"].evaluate(state, "away"), "yes");
  // No red card was shown.
  assert.equal(TEMPLATES_BY_ID["red_card_shown"].evaluate(state, null), "no");
});

test("an early red card settles yes and stays yes", () => {
  let state = initialMatchState("fx-1");
  state = applyEvents(state, [
    ev({ kind: "phase_change", phase: "first_half" }),
    ev({ kind: "red_card", team: "home", minute: 30 }),
  ]);
  // Still in the first half, but the answer is already settled.
  assert.equal(TEMPLATES_BY_ID["red_card_shown"].evaluate(state, null), "yes");
});
