import assert from "node:assert/strict";
import { test } from "node:test";
import { buildLeaderboard, scoreMembers } from "../src/lib/scoring/score";
import { answer, member, question } from "./helpers";

test("a correct swipe earns the question points", () => {
  const a = member("Ana");
  // Four one point questions and one three point question.
  const q1 = question(1, 1, "yes");
  const q5 = question(5, 3, "yes");

  const answers = [
    answer(a.id, q1.id, "yes"), // correct, plus one
    answer(a.id, q5.id, "yes"), // correct, plus three
  ];

  const totals = scoreMembers([a], [q1, q5], answers);
  assert.equal(totals.get(a.id), 4);
});

test("a wrong swipe and pending or void questions earn nothing", () => {
  const a = member("Ana");
  const wrong = question(1, 1, "no");
  const pending = question(2, 1, "pending");
  const voided = question(3, 1, "void");

  const answers = [
    answer(a.id, wrong.id, "yes"), // wrong
    answer(a.id, pending.id, "yes"), // not resolved
    answer(a.id, voided.id, "yes"), // voided
  ];

  const totals = scoreMembers([a], [wrong, pending, voided], answers);
  assert.equal(totals.get(a.id), 0);
});

test("leaderboard ranks players and marks winner and loser", () => {
  const ana = member("Ana", "2026-07-16T00:00:01.000Z");
  const ben = member("Ben", "2026-07-16T00:00:02.000Z");
  const cara = member("Cara", "2026-07-16T00:00:03.000Z");

  const q = question(5, 3, "yes");
  const answers = [
    answer(ana.id, q.id, "yes"), // 3 points
    answer(ben.id, q.id, "no"), // 0 points
    answer(cara.id, q.id, "no"), // 0 points
  ];

  const board = buildLeaderboard([ana, ben, cara], [q], answers);

  assert.equal(board[0].memberId, ana.id);
  assert.equal(board[0].points, 3);
  assert.equal(board[0].rank, 1);
  assert.equal(board[0].isWinner, true);
  assert.equal(board[0].isLoser, false);

  // Ben and Cara are tied at zero, so they share rank two and both are losers.
  assert.equal(board[1].rank, 2);
  assert.equal(board[2].rank, 2);
  assert.equal(board[1].isLoser, true);
  assert.equal(board[2].isLoser, true);
});

test("when everyone is tied there is no loser", () => {
  const ana = member("Ana", "2026-07-16T00:00:01.000Z");
  const ben = member("Ben", "2026-07-16T00:00:02.000Z");
  const q = question(1, 1, "yes");
  const answers = [answer(ana.id, q.id, "yes"), answer(ben.id, q.id, "yes")];

  const board = buildLeaderboard([ana, ben], [q], answers);
  assert.equal(board[0].isWinner, true);
  assert.equal(board[1].isWinner, true);
  assert.equal(board[0].isLoser, false);
  assert.equal(board[1].isLoser, false);
});
