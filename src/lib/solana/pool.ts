// Builds the instructions for the pool escrow program.
//
// The program was written with Anchor, but the web app talks to it without the
// generated client so there is nothing to build or copy in. Each instruction is
// an 8 byte tag (the Anchor discriminator, sha256("global:<name>") cut to eight
// bytes) followed by the borsh encoded arguments. The account order matches the
// structs in anchor/programs/called_it_pool/src/lib.rs exactly.

import { Buffer } from "buffer";
import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import type { PayoutMode } from "../types";

// Precomputed discriminators for the five instructions.
const DISCRIMINATOR = {
  createPool: [233, 146, 209, 142, 207, 104, 64, 188],
  joinPool: [14, 65, 62, 16, 116, 17, 195, 107],
  lockPool: [154, 202, 217, 175, 178, 161, 30, 152],
  settlePool: [186, 11, 231, 111, 242, 241, 203, 64],
  cancelPool: [211, 11, 27, 100, 252, 115, 57, 77],
} as const;

const POOL_SEED = Buffer.from("pool");
const VAULT_SEED = Buffer.from("vault");

// The three payout modes as the small numbers the program stores. The program
// does not act on this; the backend works out the amounts. It is kept for the
// record only.
const MODE_CODE: Record<PayoutMode, number> = {
  winner_takes_all: 0,
  top_three: 1,
  all_but_loser: 2,
};

export function poolProgramId(): PublicKey | null {
  const raw = process.env.NEXT_PUBLIC_POOL_PROGRAM_ID;
  if (!raw) return null;
  try {
    return new PublicKey(raw);
  } catch {
    return null;
  }
}

export function settlementAuthorityPubkey(): PublicKey | null {
  const raw = process.env.NEXT_PUBLIC_SETTLEMENT_PUBKEY;
  if (!raw) return null;
  try {
    return new PublicKey(raw);
  } catch {
    return null;
  }
}

// The escrow can only run when the program is deployed and the settlement key is
// known. Until then the app uses the mock backend and never calls these builders.
export function escrowConfigured(): boolean {
  return poolProgramId() !== null && settlementAuthorityPubkey() !== null;
}

// A room's code becomes the 16 byte seed the pool address is derived from. Codes
// are short, so the bytes are zero padded to a fixed length.
export function roomSeedFromCode(code: string): Buffer {
  const seed = Buffer.alloc(16);
  Buffer.from(code, "utf8").copy(seed, 0, 0, 16);
  return seed;
}

export function derivePoolPda(
  programId: PublicKey,
  creator: PublicKey,
  roomSeed: Buffer,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [POOL_SEED, creator.toBuffer(), roomSeed],
    programId,
  );
}

export function deriveVaultPda(
  programId: PublicKey,
  pool: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [VAULT_SEED, pool.toBuffer()],
    programId,
  );
}

function u64(value: number): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(Math.trunc(value)));
  return buf;
}

function tag(name: keyof typeof DISCRIMINATOR): Buffer {
  return Buffer.from(DISCRIMINATOR[name]);
}

export interface CreatePoolArgs {
  programId: PublicKey;
  creator: PublicKey;
  pool: PublicKey;
  vault: PublicKey;
  roomSeed: Buffer;
  stakeLamports: number;
  payoutMode: PayoutMode;
  settlementAuthority: PublicKey;
}

export function buildCreatePoolIx(args: CreatePoolArgs): TransactionInstruction {
  const data = Buffer.concat([
    tag("createPool"),
    args.roomSeed,
    u64(args.stakeLamports),
    Buffer.from([MODE_CODE[args.payoutMode]]),
    args.settlementAuthority.toBuffer(),
  ]);
  return new TransactionInstruction({
    programId: args.programId,
    keys: [
      { pubkey: args.pool, isSigner: false, isWritable: true },
      { pubkey: args.vault, isSigner: false, isWritable: true },
      { pubkey: args.creator, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

export interface JoinPoolArgs {
  programId: PublicKey;
  pool: PublicKey;
  vault: PublicKey;
  member: PublicKey;
}

export function buildJoinPoolIx(args: JoinPoolArgs): TransactionInstruction {
  return new TransactionInstruction({
    programId: args.programId,
    keys: [
      { pubkey: args.pool, isSigner: false, isWritable: true },
      { pubkey: args.vault, isSigner: false, isWritable: true },
      { pubkey: args.member, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: tag("joinPool"),
  });
}

export interface ManagePoolArgs {
  programId: PublicKey;
  pool: PublicKey;
  signer: PublicKey;
}

export function buildLockPoolIx(args: ManagePoolArgs): TransactionInstruction {
  return new TransactionInstruction({
    programId: args.programId,
    keys: [
      { pubkey: args.pool, isSigner: false, isWritable: true },
      { pubkey: args.signer, isSigner: true, isWritable: false },
    ],
    data: tag("lockPool"),
  });
}

export interface PayoutArgs {
  programId: PublicKey;
  pool: PublicKey;
  vault: PublicKey;
  signer: PublicKey;
  recipients: PublicKey[];
  amountsLamports: number[];
}

function payoutData(
  name: "settlePool" | "cancelPool",
  amounts: number[],
): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32LE(amounts.length);
  return Buffer.concat([tag(name), len, ...amounts.map(u64)]);
}

function payoutKeys(args: PayoutArgs) {
  return [
    { pubkey: args.pool, isSigner: false, isWritable: true },
    { pubkey: args.vault, isSigner: false, isWritable: true },
    { pubkey: args.signer, isSigner: true, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    // The recipients come after the fixed accounts as remaining accounts, in the
    // same order as the amounts.
    ...args.recipients.map((pubkey) => ({
      pubkey,
      isSigner: false,
      isWritable: true,
    })),
  ];
}

export function buildSettlePoolIx(args: PayoutArgs): TransactionInstruction {
  return new TransactionInstruction({
    programId: args.programId,
    keys: payoutKeys(args),
    data: payoutData("settlePool", args.amountsLamports),
  });
}

export function buildCancelPoolIx(args: PayoutArgs): TransactionInstruction {
  return new TransactionInstruction({
    programId: args.programId,
    keys: payoutKeys(args),
    data: payoutData("cancelPool", args.amountsLamports),
  });
}
