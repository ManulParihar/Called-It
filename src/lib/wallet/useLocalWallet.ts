"use client";

// A wallet backed by a keypair kept in the browser. Used for local testing so a
// whole game can run on devnet with no accounts to set up. The secret never
// leaves the machine and only ever holds devnet play funds.
//
// Because it is self funded, it asks the devnet faucet for SOL the first time a
// balance runs low, so deposits go through without any manual top up.

import { useCallback, useEffect, useState } from "react";
import { Keypair, LAMPORTS_PER_SOL, type TransactionInstruction } from "@solana/web3.js";
import { getConnection } from "../solana/connection";
import { buildTransaction } from "../solana/tx";
import type { AppWallet } from "./types";

const STORAGE_KEY = "calledit.wallet";
// Keep at least this much on hand, and top up by this much, so a few deposits
// and the pool rent are always covered.
const MIN_LAMPORTS = 0.2 * LAMPORTS_PER_SOL;
const TOP_UP_LAMPORTS = 1 * LAMPORTS_PER_SOL;

function loadKeypair(): Keypair | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw) as number[]));
  } catch {
    return null;
  }
}

function storeKeypair(keypair: Keypair): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...keypair.secretKey]));
}

export function clearLocalWallet(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function useLocalWallet(): AppWallet {
  const [keypair, setKeypair] = useState<Keypair | null>(null);
  const [ready, setReady] = useState(false);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    setKeypair(loadKeypair());
    setReady(true);
  }, []);

  const connect = useCallback(async () => {
    let kp = loadKeypair();
    if (!kp) {
      kp = Keypair.generate();
      storeKeypair(kp);
    }
    setKeypair(kp);
    return kp.publicKey.toBase58();
  }, []);

  const disconnect = useCallback(async () => {
    clearLocalWallet();
    setKeypair(null);
  }, []);

  const signAndSend = useCallback(
    async (instructions: TransactionInstruction[]) => {
      let kp = keypair;
      if (!kp) {
        kp = loadKeypair() ?? Keypair.generate();
        storeKeypair(kp);
        setKeypair(kp);
      }
      const connection = getConnection();

      const balance = await connection.getBalance(kp.publicKey);
      if (balance < MIN_LAMPORTS) {
        try {
          const airdropSig = await connection.requestAirdrop(kp.publicKey, TOP_UP_LAMPORTS);
          await connection.confirmTransaction(airdropSig, "confirmed");
        } catch {
          throw new Error(
            "Could not get devnet funds. The faucet may be busy, try again in a moment.",
          );
        }
      }

      const tx = await buildTransaction(connection, kp.publicKey, instructions);
      tx.sign(kp);
      const signature = await connection.sendRawTransaction(tx.serialize());
      await connection.confirmTransaction(signature, "confirmed");
      return signature;
    },
    [keypair],
  );

  return {
    kind: "local",
    publicKey: keypair?.publicKey.toBase58() ?? null,
    ready,
    connecting,
    connect: async () => {
      setConnecting(true);
      try {
        return await connect();
      } finally {
        setConnecting(false);
      }
    },
    disconnect,
    signAndSend,
  };
}
