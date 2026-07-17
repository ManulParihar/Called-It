// The one wallet shape the app talks to, whichever backend is behind it.
//
// A player might sign in with a browser keypair while testing locally, a Privy
// embedded wallet in the live app, or an existing wallet through the adapter.
// The rest of the code only cares about the address and being able to send a
// deposit or a payout, so those are all this interface exposes.

import type { TransactionInstruction } from "@solana/web3.js";

export type WalletKind = "local" | "privy" | "adapter";

export interface AppWallet {
  kind: WalletKind;
  // Base58 address, or null before the wallet is connected.
  publicKey: string | null;
  // True once the backend has finished starting up.
  ready: boolean;
  connecting: boolean;
  // Makes sure a wallet exists and is connected, then returns its address.
  connect: () => Promise<string | null>;
  disconnect: () => Promise<void>;
  // Signs and sends one transaction built from these instructions and returns
  // the confirmed signature.
  signAndSend: (instructions: TransactionInstruction[]) => Promise<string>;
}
