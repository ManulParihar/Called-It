// Turns the dollar stakes the game talks in into the lamports the pool program
// moves on chain.
//
// The app shows stakes as "$" but the pot lives on devnet, so a dollar maps to a
// small, fixed amount of SOL. Keeping it small means a single devnet airdrop
// covers plenty of games. Everything here is whole lamports so the shares always
// add up with no rounding drift.

import { LAMPORTS_PER_SOL } from "@solana/web3.js";

// One dollar of stake is worth this many lamports on devnet. 0.001 SOL, so a $10
// stake is 0.01 SOL and a $100 stake is 0.1 SOL.
export const LAMPORTS_PER_DOLLAR = LAMPORTS_PER_SOL / 1000;

export function usdToLamports(usd: number): number {
  return Math.round(usd * LAMPORTS_PER_DOLLAR);
}

// Cents is how payout shares are worked out, so they divide the pot cleanly.
export function centsToLamports(cents: number): number {
  return Math.round((cents * LAMPORTS_PER_DOLLAR) / 100);
}

export function lamportsToUsd(lamports: number): number {
  return lamports / LAMPORTS_PER_DOLLAR;
}
