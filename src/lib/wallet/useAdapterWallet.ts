"use client";

// A wallet backed by an existing browser wallet through the Solana wallet
// adapter. This is the "connect what you already have" option, offered in both
// local and live modes. Modern wallets register themselves, so the first
// installed one is picked when the player connects.

import { useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import type { TransactionInstruction } from "@solana/web3.js";
import { getConnection } from "../solana/connection";
import { buildTransaction } from "../solana/tx";
import type { AppWallet } from "./types";

export function useAdapterWallet(): AppWallet {
  const { publicKey, sendTransaction, connected, connecting, connect, select, wallets, disconnect } =
    useWallet();

  const doConnect = useCallback(async () => {
    if (connected && publicKey) return publicKey.toBase58();

    const installed = wallets.find((w) => w.readyState === WalletReadyState.Installed);
    if (!installed) {
      throw new Error("No Solana wallet found. Install one or use another sign in option.");
    }
    select(installed.adapter.name);
    await connect();
    return publicKey ? publicKey.toBase58() : null;
  }, [connected, publicKey, wallets, select, connect]);

  const signAndSend = useCallback(
    async (instructions: TransactionInstruction[]) => {
      if (!publicKey) throw new Error("Connect a wallet first");
      const connection = getConnection();
      const tx = await buildTransaction(connection, publicKey, instructions);
      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, "confirmed");
      return signature;
    },
    [publicKey, sendTransaction],
  );

  return {
    kind: "adapter",
    publicKey: publicKey ? publicKey.toBase58() : null,
    ready: true,
    connecting,
    connect: doConnect,
    disconnect: async () => {
      await disconnect();
    },
    signAndSend,
  };
}
