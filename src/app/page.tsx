"use client";

// Sign in: pick a name and a fighter. The device id is created here and kept
// in local storage. Returning players skip straight to the lobby.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { MASCOTS } from "@/lib/mascots";
import { MascotAvatar } from "@/components/MascotAvatar";
import { useProfile } from "@/hooks/useProfile";
import { useAppWallet } from "@/lib/wallet/WalletProvider";

// Only follow same origin paths, so the next param can never bounce a player off
// the site.
function safeNext(value: string | null): string {
  return value && value.startsWith("/") ? value : "/lobby";
}

export default function SignInPage() {
  const router = useRouter();
  const { profile, ready, save } = useProfile();
  const { wallet } = useAppWallet();
  const [name, setName] = useState("");
  const [mascotId, setMascotId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [next, setNext] = useState("/lobby");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read where to go after sign in and whether we arrived to edit. Both come
  // straight off the url so there is no need for a suspense boundary.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNext(safeNext(params.get("next")));
    if (window.location.hash === "#edit") setEditing(true);
  }, []);

  // Returning players go straight on unless they came to edit. When a next
  // destination is set that wins over the lobby, so testers land back on it.
  useEffect(() => {
    if (ready && profile && !editing) {
      if (window.location.hash === "#edit") return;
      router.replace(next);
    }
  }, [ready, profile, editing, router, next]);

  // Prefill when editing an existing profile.
  useEffect(() => {
    if (editing && profile) {
      setName(profile.displayName);
      setMascotId(profile.mascotId);
    }
  }, [editing, profile]);

  if (!ready || (profile && !editing)) return null;

  const canEnter = name.trim().length > 0 && mascotId !== null;

  async function enter() {
    if (!canEnter || !mascotId || busy) return;
    setBusy(true);
    setError(null);
    try {
      // Sign in through Solana: make sure a wallet is connected, then keep its
      // address on the profile so money rooms can take a deposit.
      const address = (await wallet.connect()) ?? wallet.publicKey;
      save(name.trim(), mascotId, address);
      router.push(next);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main style={{ display: "flex", flexDirection: "column", gap: 20, flex: 1 }}>
      <motion.header
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ textAlign: "center", paddingTop: 24 }}
      >
        <p className="eyebrow">Tonight at the arena</p>
        <h1 style={{ fontSize: 44, lineHeight: 1 }}>
          <span style={{ color: "var(--magenta)" }}>Called</span>{" "}
          <span style={{ color: "var(--lime)" }}>It</span>
        </h1>
        <div className="marquee" style={{ marginTop: 8 }}>
          <span className="marquee-inner muted" style={{ fontSize: 13 }}>
            Call the match with your crew. Winner takes the glory. Loser takes the
            forfeit. &nbsp;•&nbsp; Call the match with your crew. Winner takes the
            glory. Loser takes the forfeit. &nbsp;•&nbsp;
          </span>
        </div>
      </motion.header>

      <section>
        <p className="eyebrow" style={{ marginBottom: 8 }}>
          Pick your fighter
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 10,
          }}
        >
          {MASCOTS.map((m, i) => {
            const on = mascotId === m.id;
            return (
              <motion.button
                key={m.id}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.05 * i, type: "spring", stiffness: 300, damping: 20 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => setMascotId(m.id)}
                aria-pressed={on}
                style={{
                  background: on ? "var(--night-3)" : "var(--night-2)",
                  border: `2px solid ${on ? "var(--lime)" : "rgba(255,243,226,0.08)"}`,
                  borderRadius: "var(--radius-sm)",
                  padding: "10px 4px 6px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  boxShadow: on ? "0 0 18px rgba(200,245,39,0.35)" : "none",
                }}
              >
                <motion.div
                  animate={on ? { rotate: [0, -8, 8, 0], scale: [1, 1.15, 1] } : {}}
                  transition={{ duration: 0.4 }}
                >
                  <MascotAvatar mascotId={m.id} size={56} />
                </motion.div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: on ? "var(--lime)" : "var(--cream-dim)",
                  }}
                >
                  {m.name.replace("The ", "")}
                </span>
              </motion.button>
            );
          })}
        </div>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <p className="eyebrow">Your ring name</p>
        <input
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && enter()}
          placeholder="El Magnifico"
          maxLength={24}
          autoComplete="off"
        />
      </section>

      <div style={{ marginTop: "auto" }}>
        {error && <p className="error-line" style={{ marginBottom: 8 }}>{error}</p>}
        <motion.div whileTap={canEnter && !busy ? { scale: 0.97 } : {}}>
          <button className="btn btn-lime" disabled={!canEnter || busy} onClick={enter}>
            {busy ? "Setting up your wallet…" : "Step into the ring"}
          </button>
        </motion.div>
      </div>
    </main>
  );
}
