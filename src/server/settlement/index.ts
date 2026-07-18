// Settles the money pot for a room.
//
// This is the seam between the game logic and the Solana escrow program. The
// game works out who won and how much each person gets; this module asks the on
// chain program to pay them, or to refund everyone if the match was voided.
//
// When the escrow is configured (the program is deployed and the settlement key
// is set) it sends a real devnet transaction. Otherwise it runs in mock mode:
// it logs what it would do and reports success, so the rest of the pipeline runs
// end to end for local testing.

import { PublicKey } from "@solana/web3.js";
import type { Member, PayoutShare, Room } from "../../lib/types";
import { centsToLamports, usdToLamports } from "../../lib/money";
import { sendPayout, settlementConfigured } from "./chain";

export interface SettlementResult {
  ok: boolean;
  // Transaction signatures, empty in mock mode.
  signatures: string[];
  // Members an actual payout was sent to. A member who was owed money but had
  // no wallet on file, or whose transaction failed, is left out of this list
  // even though `ok` may still be true for the rest of the batch.
  paidMemberIds: string[];
}

export async function settleMoneyRoom(
  room: Room,
  members: Member[],
  payouts: PayoutShare[],
): Promise<SettlementResult> {
  const byId = new Map(members.map((m) => [m.id, m]));

  if (settlementConfigured() && room.poolAddress) {
    const recipients: PublicKey[] = [];
    const amounts: number[] = [];
    const memberIds: string[] = [];
    for (const share of payouts) {
      if (share.amountCents <= 0) continue;
      const wallet = byId.get(share.memberId)?.walletAddress;
      if (!wallet) continue;
      recipients.push(new PublicKey(wallet));
      amounts.push(centsToLamports(share.amountCents));
      memberIds.push(share.memberId);
    }
    if (recipients.length === 0) {
      return { ok: true, signatures: [], paidMemberIds: [] };
    }
    try {
      const signature = await sendPayout("settle", room.poolAddress, recipients, amounts);
      return { ok: true, signatures: [signature], paidMemberIds: memberIds };
    } catch (err) {
      console.error(`[settlement] settle failed for room ${room.code}:`, err);
      return { ok: false, signatures: [], paidMemberIds: [] };
    }
  }

  return mockLog(room, payouts);
}

export async function refundRoom(room: Room, members: Member[]): Promise<SettlementResult> {
  if (settlementConfigured() && room.poolAddress) {
    const recipients: PublicKey[] = [];
    const amounts: number[] = [];
    const memberIds: string[] = [];
    const stakeLamports = usdToLamports(room.stakeUsd);
    for (const member of members) {
      if (!member.walletAddress) continue;
      recipients.push(new PublicKey(member.walletAddress));
      amounts.push(stakeLamports);
      memberIds.push(member.id);
    }
    if (recipients.length === 0) {
      return { ok: true, signatures: [], paidMemberIds: [] };
    }
    try {
      const signature = await sendPayout("cancel", room.poolAddress, recipients, amounts);
      return { ok: true, signatures: [signature], paidMemberIds: memberIds };
    } catch (err) {
      console.error(`[settlement] refund failed for room ${room.code}:`, err);
      return { ok: false, signatures: [], paidMemberIds: [] };
    }
  }

  console.log(`[settlement] refund room ${room.code} to ${members.length} members`);
  return { ok: true, signatures: [], paidMemberIds: members.map((m) => m.id) };
}

function mockLog(room: Room, payouts: PayoutShare[]): SettlementResult {
  const summary = payouts
    .map((p) => `${p.memberId}: ${p.amountCents} cents`)
    .join(", ");
  const winners = payouts.filter((p) => p.amountCents > 0).map((p) => p.memberId);
  console.log(
    `[settlement] room ${room.code} pool ${room.poolAddress ?? "none"} ` +
      `mode ${room.payoutMode} winners ${winners.join("/")} payouts { ${summary} }`,
  );
  return { ok: true, signatures: [], paidMemberIds: winners };
}
