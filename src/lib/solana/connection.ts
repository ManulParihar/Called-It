// A shared Solana connection pointed at devnet.
//
// Both the browser wallets and the backend settlement key talk to the same
// cluster, so the rpc url is read from the environment with a devnet default.
// The browser reads the public variable; the server can also use the plain one.

import { Connection, clusterApiUrl } from "@solana/web3.js";

export function solanaRpcUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
    process.env.SOLANA_RPC_URL ||
    clusterApiUrl("devnet")
  );
}

let cached: Connection | null = null;

export function getConnection(): Connection {
  if (!cached) {
    cached = new Connection(solanaRpcUrl(), "confirmed");
  }
  return cached;
}
