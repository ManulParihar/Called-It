// Wraps a set of instructions into a transaction ready to sign.
//
// Every wallet backend builds transactions the same way: add the instructions,
// set who pays the fee, and stamp the latest blockhash. Keeping it here means
// the local, adapter and Privy backends share one path.

import {
  type Connection,
  type PublicKey,
  Transaction,
  type TransactionInstruction,
} from "@solana/web3.js";

export async function buildTransaction(
  connection: Connection,
  feePayer: PublicKey,
  instructions: TransactionInstruction[],
): Promise<Transaction> {
  const tx = new Transaction();
  tx.add(...instructions);
  tx.feePayer = feePayer;
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  return tx;
}
