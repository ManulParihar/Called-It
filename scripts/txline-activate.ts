// One-time setup script: subscribes a Solana wallet to TxLINE's free tier and
// activates the API token this app needs in TXLINE_API_TOKEN.
//
// It does the same three steps the TxLINE docs describe:
//   1. Send an on chain `subscribe` instruction to the TxLINE program.
//   2. Fetch a guest JWT and sign a message proving ownership of the wallet
//      that just subscribed.
//   3. Exchange that signature for a persistent API token.
//
// Usage:
//   TXLINE_KEYPAIR_PATH=./my-wallet.json npx tsx scripts/txline-activate.ts
//
// TXLINE_KEYPAIR_PATH must point to a Solana keypair file in the standard
// `solana-keygen` JSON array format. The wallet needs a small amount of SOL on
// the target cluster to pay transaction fees (the free tier costs no TxL
// tokens). On devnet, fund it first with:
//   solana airdrop 1 <pubkey> --url devnet
//
// Env vars:
//   TXLINE_KEYPAIR_PATH   path to the keypair file (required)
//   TXLINE_NETWORK        "devnet" (default) or "mainnet"
//   TXLINE_RPC_URL        overrides the default RPC for the chosen network
//   TXLINE_SERVICE_LEVEL  service tier id, default 1 (free tier)
//   TXLINE_WEEKS          subscription length in weeks, multiple of 4, default 4
//   TXLINE_LEAGUES        comma separated league ids, default none

import * as fs from "fs";
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import nacl from "tweetnacl";

import devnetIdl from "./txline/idl/txoracle.devnet.json";
import mainnetIdl from "./txline/idl/txoracle.mainnet.json";
import type { Txoracle as TxoracleDevnet } from "./txline/types/txoracle.devnet";
import type { Txoracle as TxoracleMainnet } from "./txline/types/txoracle.mainnet";

type Network = "devnet" | "mainnet";

const NETWORK_CONFIG: Record<
  Network,
  {
    rpcUrl: string;
    apiOrigin: string;
    tokenMint: PublicKey;
    idl: TxoracleDevnet | TxoracleMainnet;
  }
> = {
  devnet: {
    rpcUrl: "https://api.devnet.solana.com",
    apiOrigin: "https://txline-dev.txodds.com",
    tokenMint: new PublicKey("4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG"),
    idl: devnetIdl as unknown as TxoracleDevnet,
  },
  mainnet: {
    rpcUrl: "https://api.mainnet-beta.solana.com",
    apiOrigin: "https://txline.txodds.com",
    tokenMint: new PublicKey("Zhw9TVKp68a1QrftncMSd6ELXKDtpVMNuMGr1jNwdeL"),
    idl: mainnetIdl as unknown as TxoracleMainnet,
  },
};

function loadKeypair(path: string): Keypair {
  const raw = fs.readFileSync(path, "utf8");
  const secretKey = Uint8Array.from(JSON.parse(raw));
  return Keypair.fromSecretKey(secretKey);
}

async function main() {
  const network = (process.env.TXLINE_NETWORK || "devnet") as Network;
  const config = NETWORK_CONFIG[network];
  if (!config) {
    throw new Error(`TXLINE_NETWORK must be "devnet" or "mainnet", got "${network}"`);
  }

  const keypairPath = process.env.TXLINE_KEYPAIR_PATH;
  if (!keypairPath) {
    throw new Error("Set TXLINE_KEYPAIR_PATH to a solana-keygen JSON keypair file.");
  }
  const wallet = loadKeypair(keypairPath);
  console.log(`Wallet: ${wallet.publicKey.toBase58()} (${network})`);

  const serviceLevelId = Number(process.env.TXLINE_SERVICE_LEVEL || "1");
  const weeks = Number(process.env.TXLINE_WEEKS || "4");
  if (weeks < 4 || weeks % 4 !== 0) {
    throw new Error(`TXLINE_WEEKS must be a multiple of 4 (got ${weeks}).`);
  }
  const leagues = (process.env.TXLINE_LEAGUES || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number);

  const rpcUrl = process.env.TXLINE_RPC_URL || config.rpcUrl;
  const connection = new Connection(rpcUrl, "confirmed");
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(wallet), {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  const program = new Program(config.idl as anchor.Idl, provider) as unknown as Program<
    TxoracleDevnet | TxoracleMainnet
  >;
  console.log(`Program: ${program.programId.toBase58()}`);

  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`Wallet balance: ${balance / 1e9} SOL`);
  if (balance === 0) {
    throw new Error(
      `Wallet has no SOL on ${network}. Fund it first, e.g.:\n` +
        `  solana airdrop 1 ${wallet.publicKey.toBase58()} --url ${network}`,
    );
  }

  const userTokenAccountAddress = getAssociatedTokenAddressSync(
    config.tokenMint,
    wallet.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
  );

  const accountInfo = await connection.getAccountInfo(userTokenAccountAddress);
  if (!accountInfo) {
    console.log("Creating TxL token account (Token-2022 ATA)...");
    const tx = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        userTokenAccountAddress,
        wallet.publicKey,
        config.tokenMint,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
    );
    await anchor.web3.sendAndConfirmTransaction(connection, tx, [wallet], {
      commitment: "confirmed",
    });
  }
  const userTokenAccount = await getAccount(
    connection,
    userTokenAccountAddress,
    "confirmed",
    TOKEN_2022_PROGRAM_ID,
  );

  const [pricingMatrixPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("pricing_matrix")],
    program.programId,
  );
  const [tokenTreasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("token_treasury_v2")],
    program.programId,
  );
  const tokenTreasuryVault = getAssociatedTokenAddressSync(
    config.tokenMint,
    tokenTreasuryPda,
    true,
    TOKEN_2022_PROGRAM_ID,
  );

  console.log(`Subscribing on chain: service level ${serviceLevelId}, ${weeks} weeks...`);
  const subscribeTx = await (program.methods as any)
    .subscribe(serviceLevelId, weeks)
    .accounts({
      user: wallet.publicKey,
      pricingMatrix: pricingMatrixPda,
      tokenMint: config.tokenMint,
      userTokenAccount: userTokenAccount.address,
      tokenTreasuryVault,
      tokenTreasuryPda,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .transaction();

  const latestBlockhash = await connection.getLatestBlockhash("confirmed");
  subscribeTx.recentBlockhash = latestBlockhash.blockhash;
  subscribeTx.feePayer = wallet.publicKey;
  subscribeTx.sign(wallet);

  const txSig = await connection.sendRawTransaction(subscribeTx.serialize());
  await connection.confirmTransaction(
    {
      signature: txSig,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    },
    "confirmed",
  );
  console.log(`Subscribe transaction confirmed: ${txSig}`);

  console.log("Fetching guest JWT...");
  const jwtRes = await fetch(`${config.apiOrigin}/auth/guest/start`, { method: "POST" });
  if (!jwtRes.ok) throw new Error(`Guest token request failed with status ${jwtRes.status}`);
  const { token: jwt } = (await jwtRes.json()) as { token: string };

  const messageString = `${txSig}:${leagues.join(",")}:${jwt}`;
  const message = new TextEncoder().encode(messageString);
  const signatureBytes = nacl.sign.detached(message, wallet.secretKey);
  const walletSignature = Buffer.from(signatureBytes).toString("base64");

  console.log("Activating API token...");
  const activateRes = await fetch(`${config.apiOrigin}/api/token/activate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ txSig, walletSignature, leagues }),
  });
  if (!activateRes.ok) {
    throw new Error(`Token activation failed with status ${activateRes.status}`);
  }
  const activateText = await activateRes.text();
  let apiToken: string | undefined;
  try {
    const parsed = JSON.parse(activateText) as { token?: string } | string;
    apiToken = typeof parsed === "string" ? parsed : parsed.token;
  } catch {
    apiToken = activateText;
  }
  if (!apiToken) throw new Error("Activation response had no token");

  console.log("\nAPI token activated successfully. Add this to .env.local:\n");
  console.log(`TXLINE_API_TOKEN=${apiToken}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
