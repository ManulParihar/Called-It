"use client";

// A minimal wallet view: live balance and recent activity, each entry linking
// out to the block explorer for the full picture. Works for any wallet
// backend (Privy, adapter, local) since it only needs the address — balance
// and history are public on-chain data, not something the wallet backend has
// to provide itself.

import { useEffect, useState } from "react";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getConnection } from "@/lib/solana/connection";

const CLUSTER = "devnet";

function explorerUrl(path: string): string {
  return `https://explorer.solana.com${path}?cluster=${CLUSTER}`;
}

function formatSol(lamports: number): string {
  return (lamports / LAMPORTS_PER_SOL).toFixed(4);
}

function timeAgo(unixSeconds: number | null): string {
  if (unixSeconds == null) return "pending";
  const seconds = Math.max(0, Date.now() / 1000 - unixSeconds);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

interface TxRow {
  signature: string;
  blockTime: number | null;
  err: boolean;
}

const ROW_TEXT_STYLE = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  fontSize: 10,
  fontFamily: "var(--font-mono)",
} as const;

export function WalletPanel({ address }: { address: string }) {
  const [lamports, setLamports] = useState<number | null>(null);
  const [txs, setTxs] = useState<TxRow[] | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const connection = getConnection();
    const pubkey = new PublicKey(address);

    async function loadTxs() {
      try {
        const sigs = await connection.getSignaturesForAddress(pubkey, { limit: 5 });
        if (cancelled) return;
        setTxs(
          sigs.map((s) => ({
            signature: s.signature,
            blockTime: s.blockTime ?? null,
            err: s.err !== null,
          })),
        );
      } catch {
        if (!cancelled) setTxs([]);
      }
    }

    connection
      .getBalance(pubkey)
      .then((b) => !cancelled && setLamports(b))
      .catch(() => {});
    loadTxs();

    // Push updates as they land instead of polling: a new deposit or payout
    // touches the balance, so re-reading activity from the same callback
    // keeps the recent-transactions list current too.
    const subId = connection.onAccountChange(
      pubkey,
      (info) => {
        if (cancelled) return;
        setLamports(info.lamports);
        loadTxs();
      },
      "confirmed",
    );

    return () => {
      cancelled = true;
      connection.removeAccountChangeListener(subId);
    };
  }, [address]);

  async function copyAddress() {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--chalk-dim)",
        }}
      >
        <span>Wallet</span>
        <span>{CLUSTER}</span>
      </div>

      <button
        onClick={copyAddress}
        style={{
          ...ROW_TEXT_STYLE,
          background: "none",
          border: "none",
          padding: 0,
          font: "inherit",
          color: "var(--chalk-dim)",
          cursor: "pointer",
        }}
      >
        <span>
          {address.slice(0, 4)}…{address.slice(-4)}
        </span>
        <span>{copied ? "Copied" : "Tap to copy"}</span>
      </button>

      <p className="display tnum" style={{ fontSize: 22, color: "var(--amber)" }}>
        {lamports === null ? "…" : `${formatSol(lamports)} SOL`}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {txs === null && (
          <p className="muted" style={{ fontSize: 11 }}>
            Loading activity…
          </p>
        )}
        {txs !== null && txs.length === 0 && (
          <p className="muted" style={{ fontSize: 11 }}>
            No transactions yet
          </p>
        )}
        {txs?.map((tx) => (
          <a
            key={tx.signature}
            href={explorerUrl(`/tx/${tx.signature}`)}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              ...ROW_TEXT_STYLE,
              color: tx.err ? "var(--stamp-bright)" : "var(--chalk-dim)",
              textDecoration: "none",
            }}
          >
            <span>
              {tx.signature.slice(0, 4)}…{tx.signature.slice(-4)}
            </span>
            <span>{tx.err ? "failed" : timeAgo(tx.blockTime)}</span>
          </a>
        ))}
      </div>

      <a
        href={explorerUrl(`/address/${address}`)}
        target="_blank"
        rel="noopener noreferrer"
        className="muted"
        style={{ fontSize: 10, textDecoration: "underline", alignSelf: "flex-start" }}
      >
        View full history on Explorer
      </a>
    </div>
  );
}
