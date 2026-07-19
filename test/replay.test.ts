import assert from "node:assert/strict";
import { test } from "node:test";
import {
  initialMatchState,
  isFinished,
  isVoid,
  matchWinner,
  type MatchEvent,
} from "../src/lib/match";
import { applyEvents } from "../src/lib/match-reducer";
import { closeTimeline, loadReplayLines } from "../src/server/txline/replay";
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

test("a recording that stops at the shootout is given an ending", () => {
  const lines = closeTimeline([
    { offsetMs: 0, kind: "phase_change", phase: "first_half", minute: 1 },
    { offsetMs: 9000, kind: "phase_change", phase: "awaiting_penalties", minute: 120 },
  ]);
  assert.equal(lines.length, 3);
  assert.equal(lines[2].phase, "penalties_end");
  assert.ok(lines[2].offsetMs > 9000);
});

test("a recording that stops mid match is closed at full time", () => {
  const lines = closeTimeline([
    { offsetMs: 0, kind: "phase_change", phase: "first_half", minute: 1 },
    { offsetMs: 3000, kind: "goal", team: "home", minute: 55 },
    { offsetMs: 4000, kind: "phase_change", phase: "second_half", minute: 60 },
  ]);
  assert.equal(lines[lines.length - 1].phase, "ended");
});

test("a finished or abandoned recording is left alone", () => {
  const ended = [
    { offsetMs: 0, kind: "phase_change" as const, phase: "first_half" as const },
    { offsetMs: 9000, kind: "phase_change" as const, phase: "ended" as const },
  ];
  assert.equal(closeTimeline(ended).length, 2);

  const abandoned = [
    { offsetMs: 0, kind: "phase_change" as const, phase: "first_half" as const },
    { offsetMs: 9000, kind: "phase_change" as const, phase: "abandoned" as const },
  ];
  assert.equal(closeTimeline(abandoned).length, 2);
});

test("every recorded replay plays through to a result", async () => {
  const { readdir } = await import("node:fs/promises");
  const files = (await readdir("data/replays")).filter((f) => f.endsWith(".jsonl"));
  assert.ok(files.length > 0);
  for (const file of files) {
    const lines = await loadReplayLines(`data/replays/${file}`);
    const events: MatchEvent[] = lines.map((line) => ({
      fixtureId: "fx",
      kind: line.kind,
      team: line.team,
      minute: line.minute,
      phase: line.phase,
      receivedAt: "2026-07-16T02:00:00.000Z",
    }));
    const state = applyEvents(initialMatchState("fx"), events);
    assert.ok(
      isFinished(state) || isVoid(state),
      `${file} ends on ${state.phase}, so a room replaying it never settles`,
    );
  }
});
