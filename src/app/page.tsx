"use client";

// Sign in: pick a club and put a name on your slip. The device id is created
// here and kept in local storage. Returning players skip straight to the lobby.

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

const EASE = [0.23, 1, 0.32, 1] as const;

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
  const club = MASCOTS.find((m) => m.id === mascotId) ?? null;

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
    <main style={{ display: "flex", flexDirection: "column", gap: 22, flex: 1 }}>
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE }}
        style={{ textAlign: "center", paddingTop: 20 }}
      >
        <p className="eyebrow">Match night</p>
        <h1 style={{ fontSize: 52, lineHeight: 1, color: "var(--chalk)" }}>
          Called <span style={{ color: "var(--amber)" }}>It</span>
        </h1>
        <p className="muted" style={{ marginTop: 8, fontSize: 14 }}>
          Five calls each. The match decides. Somebody pays.
        </p>
      </motion.header>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE, delay: 0.06 }}
      >
        <p className="eyebrow" style={{ marginBottom: 8 }}>
          Pick your club
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
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 + 0.04 * i, duration: 0.25, ease: EASE }}
                whileTap={{ scale: 0.94 }}
                onClick={() => setMascotId(m.id)}
                aria-pressed={on}
                style={{
                  background: on ? "var(--pitch-3)" : "var(--pitch-2)",
                  border: `1px solid ${on ? "var(--amber)" : "var(--chalk-line)"}`,
                  borderRadius: "var(--radius-sm)",
                  padding: "10px 4px 7px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 5,
                  minHeight: 92,
                }}
              >
                <MascotAvatar mascotId={m.id} size={54} />
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: on ? "var(--amber)" : "var(--chalk-dim)",
                  }}
                >
                  {m.name.replace("The ", "")}
                </span>
              </motion.button>
            );
          })}
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE, delay: 0.12 }}
        style={{ display: "flex", flexDirection: "column", gap: 8 }}
      >
        <label className="eyebrow" htmlFor="slip-name">
          Name on the slip
        </label>
        <input
          id="slip-name"
          className="field"
          style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && enter()}
          placeholder="The Gaffer"
          maxLength={24}
          autoComplete="off"
          spellCheck={false}
        />
      </motion.section>

      {/* your member stub, printing itself as you type */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE, delay: 0.18 }}
        aria-hidden
      >
        <div className="slip" style={{ padding: "12px 14px", fontSize: 12 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              letterSpacing: "0.12em",
              color: "var(--ink-soft)",
              fontWeight: 700,
            }}
          >
            <span>CALLED IT</span>
            <span>MEMBER STUB</span>
          </div>
          <hr className="slip-rule" />
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
              <p style={{ fontWeight: 700, fontSize: 14 }}>
                CLUB&nbsp;&nbsp;{club ? club.name.toUpperCase() : "—"}
              </p>
              <p style={{ fontWeight: 700, fontSize: 14 }}>
                NAME&nbsp;&nbsp;{name.trim() ? name.trim().toUpperCase() : "—"}
              </p>
            </div>
            {club && <MascotAvatar mascotId={club.id} size={44} />}
          </div>
        </div>
        <div className="slip-tear" />
      </motion.section>

      <div style={{ marginTop: "auto" }}>
        {error && <p className="error-line" style={{ marginBottom: 8 }}>{error}</p>}
        <button className="btn" disabled={!canEnter || busy} onClick={enter}>
          {busy ? "Sorting your wallet…" : "Get my slip"}
        </button>
      </div>
    </main>
  );
}
