// Settles the money pot for a room.
//
// This is the seam between the game logic and the Solana escrow program. The
// game works out who won and how much each person gets; this module asks the
// on chain program to pay them, or to refund everyone if the match was voided.
//
// The on chain client is added later. For now these functions log what they
// would do and report success, so the rest of the pipeline runs end to end and
// the payout amounts can be checked. Wiring the real program in only changes
// this file.

import type { LeaderboardEntry, PayoutShare, Room } from "../../lib/types";

export interface SettlementResult {
  ok: boolean;
  // Transaction signatures, once the on chain program is wired in.
  signatures: string[];
}

export async function settleMoneyRoom(
  room: Room,
  leaderboard: LeaderboardEntry[],
  payouts: PayoutShare[],
): Promise<SettlementResult> {
  const summary = payouts
    .map((p) => `${p.memberId}: ${p.amountCents} cents`)
    .join(", ");
  console.log(
    `[settlement] room ${room.code} pool ${room.poolAddress ?? "none"} ` +
      `mode ${room.payoutMode} winners ${winnerIds(leaderboard).join("/")} ` +
      `payouts { ${summary} }`,
  );
  return { ok: true, signatures: [] };
}

export async function refundRoom(room: Room, memberIds: string[]): Promise<SettlementResult> {
  console.log(
    `[settlement] refund room ${room.code} to ${memberIds.length} members`,
  );
  return { ok: true, signatures: [] };
}

function winnerIds(leaderboard: LeaderboardEntry[]): string[] {
  return leaderboard.filter((e) => e.isWinner).map((e) => e.memberId);
}
