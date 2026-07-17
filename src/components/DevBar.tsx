"use client";

// A small strip of testing controls pinned to the bottom of a room. It only
// renders during development, never in a production build, so players never see
// it. It lets one person drive a whole game from a single browser:
//
//   New tester   forgets this browser's identity and returns to the join
//                screen, so you can join the same room again as someone else.
//   Play         advances the match a few events at a time, so you can watch
//                the live screen react.
//   End game     runs the rest of the match at once, taking the room to full
//                time so the payout or the forfeit screen shows.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { simulateRoom } from "@/lib/api";
import { useProfile } from "@/hooks/useProfile";

const ENABLED = process.env.NODE_ENV !== "production";

export function DevBar({
  code,
  onChanged,
}: {
  code: string;
  onChanged: () => void;
}) {
  const router = useRouter();
  const { profile, reset } = useProfile();
  const [busy, setBusy] = useState<null | "play" | "end">(null);
  const [note, setNote] = useState<string | null>(null);

  if (!ENABLED) return null;

  function newTester() {
    reset();
    router.push(`/?next=${encodeURIComponent(`/join/${code}`)}`);
  }

  async function run(kind: "play" | "end") {
    if (busy) return;
    setBusy(kind);
    setNote(null);
    try {
      const result = await simulateRoom(
        code,
        kind === "end" ? { toEnd: true } : { steps: 3 },
      );
      setNote(
        result.done
          ? `Full time (${result.status})`
          : `${result.phase} · ${result.remaining} events left`,
      );
      onChanged();
    } catch (err) {
      setNote((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
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
        >
          New tester
        </button>
        <button
          className="btn btn-small"
          style={{ flex: 1 }}
          onClick={() => run("play")}
          disabled={busy !== null}
        >
          {busy === "play" ? "Playing…" : "Play"}
        </button>
        <button
          className="btn btn-small"
          style={{ flex: 1 }}
          onClick={() => run("end")}
          disabled={busy !== null}
        >
          {busy === "end" ? "Ending…" : "End game"}
        </button>
      </div>
    </div>
  );
}
