// The on chain side of settlement.
//
// The backend holds one keypair, the settlement authority, that the pool program
// trusts to pay a pool out or refund it. This module loads that key and sends
// the settle or cancel transaction. It never decides who won; it is handed the
// recipients and the amounts the game already worked out.

import {
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
} from "@solana/web3.js";
import { utils } from "@coral-xyz/anchor";
import { getConnection } from "../../lib/solana/connection";
import {
  buildCancelPoolIx,
  buildSettlePoolIx,
  deriveVaultPda,
  poolProgramId,
} from "../../lib/solana/pool";

// The escrow can only pay out when the program is deployed and the authority key
// is set. Until then the caller uses the mock backend.
export function settlementConfigured(): boolean {
  return Boolean(process.env.SETTLEMENT_AUTHORITY_SECRET) && poolProgramId() !== null;
}

// Loads the authority keypair. The secret is accepted either as a base58 string
// or as a JSON array of bytes, so it can be pasted straight from the Solana CLI
// or from `anchor` output.
function loadAuthority(): Keypair {
  const raw = process.env.SETTLEMENT_AUTHORITY_SECRET;
  if (!raw) throw new Error("SETTLEMENT_AUTHORITY_SECRET is not set");
  const trimmed = raw.trim();
  const bytes = trimmed.startsWith("[")
    ? Uint8Array.from(JSON.parse(trimmed) as number[])
    : utils.bytes.bs58.decode(trimmed);
  return Keypair.fromSecretKey(bytes);
}

export type PayoutKind = "settle" | "cancel";

// Sends the payout. The recipients and amounts line up by index, matching what
// the program expects. Returns the transaction signature.
export async function sendPayout(
  kind: PayoutKind,
  poolAddress: string,
  recipients: PublicKey[],
  amountsLamports: number[],
): Promise<string> {
  const programId = poolProgramId();
  if (!programId) throw new Error("Pool program id is not set");

  const authority = loadAuthority();
  const pool = new PublicKey(poolAddress);
  const [vault] = deriveVaultPda(programId, pool);

  const build = kind === "cancel" ? buildCancelPoolIx : buildSettlePoolIx;
  const instruction = build({
    programId,
    pool,
    vault,
    signer: authority.publicKey,
    recipients,
    amountsLamports,
  });

  const connection = getConnection();
  const tx = new Transaction().add(instruction);
  return sendAndConfirmTransaction(connection, tx, [authority]);
}
