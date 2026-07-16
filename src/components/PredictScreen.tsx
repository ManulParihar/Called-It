"use client";

// Make your five calls. Swipe through the deck, check the recap, lock it in.

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { submitAnswers } from "@/lib/api";
import type { Member, RoomBundle, Swipe } from "@/lib/types";
import { SwipeDeck } from "./SwipeDeck";

export function PredictScreen({
  bundle,
  me,
  onSubmitted,
}: {
  bundle: RoomBundle;
  me: Member;
  onSubmitted: () => void;
}) {
  const questions = useMemo(
    () => [...bundle.questions].sort((a, b) => a.slot - b.slot),
    [bundle.questions],
  );
  const [picks, setPicks] = useState<{ questionId: string; choice: Swipe }[] | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function lockIn() {
    if (!picks || busy) return;
    setBusy(true);
    setError(null);
    try {
      await submitAnswers(bundle.room.code, me.id, picks);
      onSubmitted();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const byId = new Map(questions.map((q) => [q.id, q]));

  return (
    <main style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
      <header style={{ textAlign: "center", paddingTop: 8 }}>
        <p className="eyebrow">{bundle.room.fixture.competition}</p>
        <h1 style={{ fontSize: 22 }}>
          {bundle.room.fixture.homeTeam}{" "}
          <span style={{ color: "var(--tangerine)" }}>vs</span>{" "}
          {bundle.room.fixture.awayTeam}
        </h1>
        <p className="muted" style={{ marginTop: 4 }}>
          Swipe <span style={{ color: "var(--lime)", fontWeight: 700 }}>right for yes</span>,{" "}
          <span style={{ color: "var(--danger)", fontWeight: 700 }}>left for no</span>.
        </p>
      </header>

      {!picks ? (
        <SwipeDeck questions={questions} onDone={setPicks} />
      ) : (
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}
        >
          <h2 style={{ fontSize: 18, textAlign: "center", color: "var(--gold)" }}>
            Your five calls
          </h2>
          {picks.map((pick, i) => {
            const q = byId.get(pick.questionId);
            if (!q) return null;
            const yes = pick.choice === "yes";
            return (
              <motion.div
                key={pick.questionId}
                initial={{ opacity: 0, x: -18 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.06 * i }}
                className="card"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  borderColor: q.points === 3 ? "var(--gold)" : undefined,
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>
                  {q.text}
                  {q.points === 3 && (
                    <span style={{ color: "var(--gold)", fontWeight: 800 }}> ·3pt</span>
                  )}
                </span>
                <span
                  className="display"
                  style={{
                    fontSize: 15,
                    color: yes ? "var(--lime)" : "var(--danger)",
                  }}
                >
                  {pick.choice}
                </span>
              </motion.div>
            );
          })}

          {error && <p className="error-line">{error}</p>}

          <div style={{ marginTop: "auto", display: "flex", gap: 10 }}>
            <button
              className="btn btn-ghost"
              style={{ flex: 1 }}
              onClick={() => setPicks(null)}
              disabled={busy}
            >
              Redo
            </button>
            <button
              className="btn btn-lime"
              style={{ flex: 2 }}
              onClick={lockIn}
              disabled={busy}
            >
              {busy ? "Locking…" : "Lock it in"}
            </button>
          </div>
        </motion.section>
      )}
    </main>
  );
}
