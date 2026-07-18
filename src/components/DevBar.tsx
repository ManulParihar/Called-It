"use client";

// A small menu of testing controls, tucked behind a gear button top-right. It
// only renders during development, never in a production build, so players
// never see it. It lets one person drive a whole game from a single browser:
//
//   New tester   forgets this browser's identity and returns to the join
//                screen, so you can join the same room again as someone else.
//   Play         auto-runs the whole match, one moment at a time, holding ~3s
//                between each so the live screen (and a demo recording) can
//                breathe. The top-right ring counts that gap down.
//   End game     cuts straight to full time, even mid auto-play, so the payout
//                or the forfeit screen shows.
//
// Tucked away rather than pinned to the screen so the default view stays
// close to what players actually see.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { simulateRoom } from "@/lib/api";
import { useProfile } from "@/hooks/useProfile";
import { useAppWallet } from "@/lib/wallet/WalletProvider";
import { MomentRing } from "@/components/MomentRing";

const ENABLED = process.env.NODE_ENV !== "production";

// The beat between moments. Matches the countdown ring's default duration.
const GAP_MS = 3000;

export function DevBar({
  code,
  onChanged,
}: {
  code: string;
  onChanged: () => void;
}) {
  const router = useRouter();
  const { profile, reset } = useProfile();
  const { wallet } = useAppWallet();
  const [mode, setMode] = useState<"idle" | "playing" | "ending">("idle");
  const [note, setNote] = useState<string | null>(null);
  const [ringShow, setRingShow] = useState(false);
  const [ringCycle, setRingCycle] = useState(0);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const stopRef = useRef(false);
  const wakeRef = useRef<null | (() => void)>(null);
  const loopRef = useRef<Promise<void> | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Stop the auto-runner if the room unmounts mid-match.
  useEffect(() => {
    return () => {
      stopRef.current = true;
      wakeRef.current?.();
    };
  }, []);

  // Close on an outside tap, so the menu behaves like the rest of the UI.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  if (!ENABLED) return null;

  function newTester() {
    reset();
    router.push(`/?next=${encodeURIComponent(`/join/${code}`)}`);
  }

  async function copyWallet() {
    if (!wallet.publicKey) return;
    await navigator.clipboard.writeText(wallet.publicKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // A sleep the End button (or unmount) can cut short.
  function gap(ms: number) {
    return new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        wakeRef.current = null;
        resolve();
      }, ms);
      wakeRef.current = () => {
        clearTimeout(timer);
        wakeRef.current = null;
        resolve();
      };
    });
  }

  // Advance the match one moment at a time until it settles or is stopped.
  // Never rejects, so the callers can await it safely.
  async function autoPlay() {
    stopRef.current = false;
    try {
      while (!stopRef.current) {
        const result = await simulateRoom(code, { steps: 1 });
        onChanged();
        setNote(
          result.done
            ? `Full time (${result.status})`
            : `${result.phase} · ${result.remaining} left`,
        );
        if (result.done || result.status === "settled" || stopRef.current) break;
        setRingCycle((c) => c + 1);
        setRingShow(true);
        await gap(GAP_MS);
      }
    } catch (err) {
      setNote((err as Error).message);
    } finally {
      setRingShow(false);
    }
  }

  async function play() {
    if (mode !== "idle") return;
    setMode("playing");
    setNote(null);
    const running = autoPlay();
    loopRef.current = running;
    await running;
    loopRef.current = null;
    // Return to idle only if End didn't take over in the meantime.
    setMode((m) => (m === "playing" ? "idle" : m));
  }

  async function end() {
    if (mode === "ending") return;
    setMode("ending");
    setNote(null);
    // Stop any running auto-play and let it unwind before finishing.
    stopRef.current = true;
    wakeRef.current?.();
    try {
      if (loopRef.current) await loopRef.current;
      const result = await simulateRoom(code, { toEnd: true });
      onChanged();
      setNote(`Full time (${result.status})`);
    } catch (err) {
      setNote((err as Error).message);
    } finally {
      setMode("idle");
    }
  }

  return (
    <>
      {/* Shifted left of the gear button so the two never overlap. */}
      <MomentRing show={ringShow} cycle={ringCycle} seconds={GAP_MS / 1000} right={64} />

      <div
        ref={panelRef}
        style={{
          position: "fixed",
          top: "calc(12px + env(safe-area-inset-top))",
          right: "calc(12px + env(safe-area-inset-right))",
          zIndex: 60,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 8,
        }}
      >
        <motion.button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label="Testing tools"
          whileTap={{ scale: 0.9 }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 40,
            height: 40,
            minWidth: 40,
            minHeight: 40,
            padding: 0,
            borderRadius: "50%",
            border: "1px solid var(--chalk-line)",
            background: open ? "var(--pitch-2)" : "rgba(8, 17, 13, 0.92)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            boxShadow: "0 3px 0 rgba(0,0,0,0.4)",
            color: "var(--chalk-dim)",
            cursor: "pointer",
          }}
        >
          <svg
            width={20}
            height={20}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ display: "block" }}
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
          </svg>
        </motion.button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              style={{
                width: 240,
                background: "rgba(8,17,13,0.96)",
                border: "1px solid var(--chalk-line)",
                borderRadius: "var(--radius)",
                padding: 10,
                display: "flex",
                flexDirection: "column",
                gap: 8,
                backdropFilter: "blur(6px)",
                WebkitBackdropFilter: "blur(6px)",
                boxShadow: "0 6px 20px rgba(0,0,0,0.4)",
              }}
            >
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
                <span>Testing tools</span>
                <span>{note ?? (profile ? `as ${profile.displayName}` : "no player")}</span>
              </div>

              {wallet.publicKey && (
                <button
                  onClick={copyWallet}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "none",
                    border: "none",
                    padding: 0,
                    font: "inherit",
                    color: "var(--chalk-dim)",
                    fontSize: 10,
                    fontFamily: "var(--font-mono)",
                    cursor: "pointer",
                  }}
                >
                  <span>
                    {wallet.kind} wallet · {wallet.publicKey.slice(0, 4)}…
                    {wallet.publicKey.slice(-4)}
                  </span>
                  <span>{copied ? "Copied" : "Tap to copy"}</span>
                </button>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <button
                  className="btn btn-ghost btn-small"
                  style={{ width: "100%" }}
                  onClick={newTester}
                  disabled={mode !== "idle"}
                >
                  New tester
                </button>
                <button
                  className="btn btn-small"
                  style={{ width: "100%" }}
                  onClick={play}
                  disabled={mode !== "idle"}
                >
                  {mode === "playing" ? "Playing…" : "Play"}
                </button>
                <button
                  className="btn btn-small"
                  style={{ width: "100%" }}
                  onClick={end}
                  disabled={mode === "ending"}
                >
                  {mode === "ending" ? "Ending…" : "End game"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
