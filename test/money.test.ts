import assert from "node:assert/strict";
import { test } from "node:test";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  LAMPORTS_PER_DOLLAR,
  centsToLamports,
  lamportsToUsd,
  usdToLamports,
} from "../src/lib/money";

test("a dollar is a fixed slice of a SOL", () => {
  assert.equal(LAMPORTS_PER_DOLLAR, LAMPORTS_PER_SOL / 1000);
  assert.equal(usdToLamports(10), 10_000_000);
  assert.equal(usdToLamports(100), 100_000_000);
});

test("cents and dollars land on the same lamports", () => {
  assert.equal(centsToLamports(2000), usdToLamports(20));
  assert.equal(centsToLamports(1000), usdToLamports(10));
});

test("lamports convert back to the dollar amount", () => {
  assert.equal(lamportsToUsd(usdToLamports(50)), 50);
});

test("a split in cents adds back up to the pot with no drift", () => {
  // A $10 three way pot split as evenly as cents allow.
  const shares = [334, 333, 333].map((c) => centsToLamports(c));
  const total = shares.reduce((sum, n) => sum + n, 0);
  assert.equal(total, centsToLamports(1000));
});
