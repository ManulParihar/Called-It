import assert from "node:assert/strict";
import { test } from "node:test";
import { computePayouts } from "../src/lib/scoring/payout";
import type { LeaderboardEntry, PayoutShare } from "../src/lib/types";

function entry(
  memberId: string,
  points: number,
  rank: number,
  isWinner: boolean,
  isLoser: boolean,
): LeaderboardEntry {
  return { memberId, displayName: memberId, mascotId: "fox", points, rank, isWinner, isLoser };
}

function sum(shares: PayoutShare[]): number {
  return shares.reduce((total, s) => total + s.amountCents, 0);
}

function amountFor(shares: PayoutShare[], memberId: string): number {
  return shares.find((s) => s.memberId === memberId)?.amountCents ?? 0;
}

test("winner takes all gives the pot to the top scorer", () => {
  const board = [
    entry("a", 7, 1, true, false),
    entry("b", 3, 2, false, false),
    entry("c", 0, 3, false, true),
  ];
  const shares = computePayouts("winner_takes_all", board, 3000);
  assert.equal(amountFor(shares, "a"), 3000);
  assert.equal(amountFor(shares, "b"), 0);
  assert.equal(sum(shares), 3000);
});

test("winner takes all splits between tied winners", () => {
  const board = [
    entry("a", 5, 1, true, false),
    entry("b", 5, 1, true, false),
    entry("c", 1, 3, false, true),
  ];
  const shares = computePayouts("winner_takes_all", board, 1001);
  // Odd cent goes to the first listed winner.
  assert.equal(amountFor(shares, "a"), 501);
  assert.equal(amountFor(shares, "b"), 500);
  assert.equal(sum(shares), 1001);
});

test("top three splits fifty thirty twenty", () => {
  const board = [
    entry("a", 7, 1, true, false),
    entry("b", 5, 2, false, false),
    entry("c", 3, 3, false, false),
    entry("d", 0, 4, false, true),
  ];
  const shares = computePayouts("top_three", board, 1000);
  assert.equal(amountFor(shares, "a"), 500);
  assert.equal(amountFor(shares, "b"), 300);
  assert.equal(amountFor(shares, "c"), 200);
  assert.equal(amountFor(shares, "d"), 0);
  assert.equal(sum(shares), 1000);
});

test("top three collapses when there are only two players", () => {
  const board = [
    entry("a", 7, 1, true, false),
    entry("b", 2, 2, false, true),
  ];
  const shares = computePayouts("top_three", board, 800);
  // Weights 50 and 30 over a total of 80.
  assert.equal(amountFor(shares, "a"), 500);
  assert.equal(amountFor(shares, "b"), 300);
  assert.equal(sum(shares), 800);
});

test("all but loser splits by points and gives the loser nothing", () => {
  const board = [
    entry("a", 6, 1, true, false),
    entry("b", 2, 2, false, false),
    entry("c", 0, 3, false, true),
  ];
  const shares = computePayouts("all_but_loser", board, 800);
  // a and b share 800 in a six to two ratio.
  assert.equal(amountFor(shares, "a"), 600);
  assert.equal(amountFor(shares, "b"), 200);
  assert.equal(amountFor(shares, "c"), 0);
  assert.equal(sum(shares), 800);
});

test("a zero pot pays nothing", () => {
  const board = [entry("a", 7, 1, true, false)];
  const shares = computePayouts("winner_takes_all", board, 0);
  assert.equal(sum(shares), 0);
});
