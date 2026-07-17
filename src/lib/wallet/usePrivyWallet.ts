"use client";

// A wallet backed by a Privy embedded wallet. This is the live path: a player
// signs in with email or a social login and Privy creates a Solana wallet for
// them, so they never touch a seed phrase. Connecting opens the Privy modal;
// the sign in screen reacts once an address appears.
//
// This path needs a Privy app id to run, so it is only mounted in the live app.

import { useCallback } from "react";
import { PublicKey, type TransactionInstruction } from "@solana/web3.js";
import { usePrivy } from "@privy-io/react-auth";
import { useSolanaWallets, useSendTransaction } from "@privy-io/react-auth/solana";
import { getConnection } from "../solana/connection";
import { buildTransaction } from "../solana/tx";
import type { AppWallet } from "./types";

export function usePrivyWallet(): AppWallet {
  const { ready, authenticated, login } = usePrivy();
  const { wallets, ready: walletsReady, createWallet } = useSolanaWallets();
  const { sendTransaction } = useSendTransaction();

  const address = wallets[0]?.address ?? null;

  const connect = useCallback(async () => {
    if (!authenticated) {
      login();
      return wallets[0]?.address ?? null;
    }
    if (wallets.length === 0) {
      const created = await createWallet();
      return created.address;
    }
    return wallets[0]?.address ?? null;
  }, [authenticated, login, wallets, createWallet]);

  const signAndSend = useCallback(
    async (instructions: TransactionInstruction[]) => {
      const owner = wallets[0]?.address;
      if (!owner) throw new Error("Sign in to your wallet first");
      const connection = getConnection();
      const tx = await buildTransaction(connection, new PublicKey(owner), instructions);
      const receipt = await sendTransaction({ transaction: tx, connection, address: owner });
      return receipt.signature;
    },
    [wallets, sendTransaction],
  );

  return {
    kind: "privy",
    publicKey: address,
    ready: ready && walletsReady,
    connecting: false,
    connect,
    disconnect: async () => {
      // Privy sign out is handled by the account menu, not per wallet.
    },
    signAndSend,
  };
}
