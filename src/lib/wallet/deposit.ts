"use client";

// Puts a player's stake into a room's pool on chain.
//
// The creator opens the pool and stakes in one go; each joiner stakes into the
// pool the creator opened. When the escrow is not configured yet (no deployed
// program) these return without a transaction, so the game still runs on the
// mock backend for local testing.

import { PublicKey } from "@solana/web3.js";
import type { Room } from "../types";
import { usdToLamports } from "../money";
import {
  buildCreatePoolIx,
  buildJoinPoolIx,
  derivePoolPda,
  deriveVaultPda,
  escrowConfigured,
  poolProgramId,
  roomSeedFromCode,
  settlementAuthorityPubkey,
} from "../solana/pool";
import type { AppWallet } from "./types";

export interface DepositResult {
  poolAddress: string | null;
  signature: string | null;
}

async function walletAddress(wallet: AppWallet): Promise<string> {
  const address = wallet.publicKey ?? (await wallet.connect());
  if (!address) throw new Error("Connect a wallet to stake");
  return address;
}

export async function createPoolAndDeposit(
  room: Room,
  wallet: AppWallet,
): Promise<DepositResult> {
  const programId = poolProgramId();
  const settlementAuthority = settlementAuthorityPubkey();
  if (!escrowConfigured() || !programId || !settlementAuthority) {
    return { poolAddress: null, signature: null };
  }

  const creator = new PublicKey(await walletAddress(wallet));
  const roomSeed = roomSeedFromCode(room.code);
  const [pool] = derivePoolPda(programId, creator, roomSeed);
  const [vault] = deriveVaultPda(programId, pool);
  const stakeLamports = usdToLamports(room.stakeUsd);

  const signature = await wallet.signAndSend([
    buildCreatePoolIx({
      programId,
      creator,
      pool,
      vault,
      roomSeed,
      stakeLamports,
      payoutMode: room.payoutMode,
      settlementAuthority,
    }),
    buildJoinPoolIx({ programId, pool, vault, member: creator }),
  ]);

  return { poolAddress: pool.toBase58(), signature };
}

export async function depositToPool(
  room: Room,
  wallet: AppWallet,
): Promise<DepositResult> {
  const programId = poolProgramId();
  if (!escrowConfigured() || !programId || !room.poolAddress) {
    return { poolAddress: room.poolAddress, signature: null };
  }

  const pool = new PublicKey(room.poolAddress);
  const [vault] = deriveVaultPda(programId, pool);
  const member = new PublicKey(await walletAddress(wallet));

  const signature = await wallet.signAndSend([
    buildJoinPoolIx({ programId, pool, vault, member }),
  ]);

  return { poolAddress: room.poolAddress, signature };
}
