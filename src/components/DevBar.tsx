"use client";

// A small strip of testing controls pinned to the bottom of a room. It only
// renders during development, never in a production build, so players never see
// it. It lets one person drive a whole game from a single browser:
//
//   New tester   forgets this browser's identity and returns to the join
//                screen, so you can join the same room again as someone else.
//   Play         auto-runs the whole match, one moment at a time, holding ~3s
//                between each so the live screen (and a demo recording) can
//                breathe. The top-right ring counts that gap down.
//   End game     cuts straight to full time, even mid auto-play, so the payout
//                or the forfeit screen shows.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { simulateRoom } from "@/lib/api";
import { useProfile } from "@/hooks/useProfile";
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
  const [mode, setMode] = useState<"idle" | "playing" | "ending">("idle");
  const [note, setNote] = useState<string | null>(null);
  const [ringShow, setRingShow] = useState(false);
  const [ringCycle, setRingCycle] = useState(0);

  const stopRef = useRef(false);
  const wakeRef = useRef<null | (() => void)>(null);
  const loopRef = useRef<Promise<void> | null>(null);

  // Stop the auto-runner if the room unmounts mid-match.
  useEffect(() => {
    return () => {
      stopRef.current = true;
      wakeRef.current?.();
    };
  }, []);

  if (!ENABLED) return null;

  function newTester() {
    reset();
    router.push(`/?next=${encodeURIComponent(`/join/${code}`)}`);
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
      <MomentRing show={ringShow} cycle={ringCycle} seconds={GAP_MS / 1000} />
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 50,
          background: "rgba(8,17,13,0.94)",
          borderTop: "1px solid var(--chalk-line)",
          padding: "8px 12px calc(8px + env(safe-area-inset-bottom))",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          backdropFilter: "blur(6px)",
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
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn btn-ghost btn-small"
            style={{ flex: 1 }}
            onClick={newTester}
            disabled={mode !== "idle"}
          >
            New tester
          </button>
          <button
            className="btn btn-small"
            style={{ flex: 1 }}
            onClick={play}
            disabled={mode !== "idle"}
          >
            {mode === "playing" ? "Playing…" : "Play"}
          </button>
          <button
            className="btn btn-small"
            style={{ flex: 1 }}
            onClick={end}
            disabled={mode === "ending"}
          >
            {mode === "ending" ? "Ending…" : "End game"}
          </button>
        </div>
      </div>
    </>
  );
}
