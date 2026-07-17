// Exercises the pool escrow on devnet end to end with two throwaway keypairs.
//
// It creates a pool, has two players stake, checks the vault holds both stakes,
// then has the settlement key pay the whole pot to the first player and checks
// the vault is emptied. Run it after deploying the program and setting the env:
//
//   NEXT_PUBLIC_POOL_PROGRAM_ID, NEXT_PUBLIC_SETTLEMENT_PUBKEY,
//   SETTLEMENT_AUTHORITY_SECRET, NEXT_PUBLIC_SOLANA_RPC_URL (optional)
//
//   npx tsx scripts/escrow-devnet.ts

import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
  type TransactionInstruction,
} from "@solana/web3.js";
import { getConnection } from "../src/lib/solana/connection";
import { usdToLamports } from "../src/lib/money";
import {
  buildCreatePoolIx,
  buildJoinPoolIx,
  buildSettlePoolIx,
  derivePoolPda,
  deriveVaultPda,
  escrowConfigured,
  poolProgramId,
  roomSeedFromCode,
  settlementAuthorityPubkey,
} from "../src/lib/solana/pool";
import { sendPayout, settlementConfigured } from "../src/server/settlement/chain";

const STAKE_USD = 10;

async function fund(connection: ReturnType<typeof getConnection>, who: PublicKey): Promise<void> {
  const sig = await connection.requestAirdrop(who, 1 * LAMPORTS_PER_SOL);
  await connection.confirmTransaction(sig, "confirmed");
}

async function send(
  connection: ReturnType<typeof getConnection>,
  payer: Keypair,
  instructions: TransactionInstruction[],
): Promise<string> {
  const tx = new Transaction().add(...instructions);
  return sendAndConfirmTransaction(connection, tx, [payer]);
}

async function main(): Promise<void> {
  if (!escrowConfigured() || !settlementConfigured()) {
    console.log(
      "Escrow is not configured. Set NEXT_PUBLIC_POOL_PROGRAM_ID, " +
        "NEXT_PUBLIC_SETTLEMENT_PUBKEY and SETTLEMENT_AUTHORITY_SECRET first.",
    );
    process.exit(0);
  }

  const programId = poolProgramId()!;
  const settlementAuthority = settlementAuthorityPubkey()!;
  const connection = getConnection();

  const creator = Keypair.generate();
  const player = Keypair.generate();
  console.log("creator", creator.publicKey.toBase58());
  console.log("player ", player.publicKey.toBase58());

  await fund(connection, creator.publicKey);
  await fund(connection, player.publicKey);

  const roomSeed = roomSeedFromCode("DEVNET1");
  const [pool] = derivePoolPda(programId, creator.publicKey, roomSeed);
  const [vault] = deriveVaultPda(programId, pool);
  const stakeLamports = usdToLamports(STAKE_USD);

  // Creator opens the pool and stakes.
  await send(connection, creator, [
    buildCreatePoolIx({
      programId,
      creator: creator.publicKey,
      pool,
      vault,
      roomSeed,
      stakeLamports,
      payoutMode: "winner_takes_all",
      settlementAuthority,
    }),
    buildJoinPoolIx({ programId, pool, vault, member: creator.publicKey }),
  ]);

  // Second player stakes.
  await send(connection, player, [
    buildJoinPoolIx({ programId, pool, vault, member: player.publicKey }),
  ]);

  const vaultBefore = await connection.getBalance(vault);
  console.log("vault after two stakes:", vaultBefore, "lamports");
  if (vaultBefore < stakeLamports * 2) {
    throw new Error("Vault does not hold both stakes");
  }

  // Settlement key pays the whole pot to the creator.
  const pot = stakeLamports * 2;
  const signature = await sendPayout("settle", pool.toBase58(), [creator.publicKey], [pot]);
  console.log("settle signature:", signature);

  const vaultAfter = await connection.getBalance(vault);
  console.log("vault after settle:", vaultAfter, "lamports");
  if (vaultAfter >= stakeLamports) {
    throw new Error("Vault was not paid out");
  }

  console.log("OK: stakes went in and the pot was paid out");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("FAILED", err);
    process.exit(1);
  });
