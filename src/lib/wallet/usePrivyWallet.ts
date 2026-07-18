"use client";

// A wallet backed by a Privy embedded wallet. This is the live path: a player
// signs in with email or a social login and Privy creates a Solana wallet for
// them, so they never touch a seed phrase. Connecting opens the Privy modal;
// the sign in screen reacts once an address appears.
//
// This path needs a Privy app id to run, so it is only mounted in the live app.

import { useCallback, useRef } from "react";
import { PublicKey, type TransactionInstruction } from "@solana/web3.js";
import { usePrivy, useLogin } from "@privy-io/react-auth";
import { useSolanaWallets, useSendTransaction } from "@privy-io/react-auth/solana";
import { getConnection } from "../solana/connection";
import { buildTransaction } from "../solana/tx";
import type { AppWallet } from "./types";

// Privy's own `login()` just opens the modal; it does not wait for the user to
// actually finish signing in. Waiting on this instead of resolving early keeps
// callers from grabbing a stale (or absent) address before the real one exists.
function waitFor(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function usePrivyWallet(): AppWallet {
  const { ready, authenticated } = usePrivy();
  const { wallets, ready: walletsReady, createWallet } = useSolanaWallets();
  const { sendTransaction } = useSendTransaction();

  // Read from a ref inside connect() rather than the closed-over `wallets`
  // value, since connect() awaits across renders and needs the latest list.
  const walletsRef = useRef(wallets);
  walletsRef.current = wallets;

  const loginWaiters = useRef<((ok: boolean) => void)[]>([]);
  const { login } = useLogin({
    onComplete: () => {
      loginWaiters.current.forEach((resolve) => resolve(true));
      loginWaiters.current = [];
    },
    onError: () => {
      loginWaiters.current.forEach((resolve) => resolve(false));
      loginWaiters.current = [];
    },
  });

  const address = wallets[0]?.address ?? null;

  const connect = useCallback(async () => {
    if (!authenticated) {
      const ok = await new Promise<boolean>((resolve) => {
        loginWaiters.current.push(resolve);
        login();
      });
      if (!ok) return null;
    }

    // The embedded wallet is created automatically on login (createOnLogin is
    // set), but it can take a moment to show up in `wallets` after auth
    // completes. Give it a few seconds before falling back to creating one
    // ourselves, so we don't mint a duplicate wallet under the same user.
    for (let waited = 0; waited < 8000; waited += 200) {
      if (walletsRef.current.length > 0) return walletsRef.current[0].address;
      await waitFor(200);
    }
    if (walletsRef.current.length > 0) return walletsRef.current[0].address;

    const created = await createWallet();
    return created.address;
  }, [authenticated, login, createWallet]);

  const signAndSend = useCallback(
    async (instructions: TransactionInstruction[], description?: string) => {
      const owner = wallets[0]?.address;
      if (!owner) throw new Error("Sign in to your wallet first");
      const connection = getConnection();
      const tx = await buildTransaction(connection, new PublicKey(owner), instructions);
      const receipt = await sendTransaction({
        transaction: tx,
        connection,
        address: owner,
        // Privy can't decode a call into our own escrow program, so without
        // this the confirmation modal just says "confirm transaction" with no
        // amount. Passing our own description is the only way to tell the
        // player what they're actually signing.
        uiOptions: description ? { description } : undefined,
      });
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
