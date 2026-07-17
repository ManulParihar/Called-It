"use client";

// Make your five calls. Swipe through the book, check the printed slip, then
// stamp it — after that it's official.

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { submitAnswers } from "@/lib/api";
import type { Member, RoomBundle, Swipe } from "@/lib/types";
import { SwipeDeck } from "./SwipeDeck";
import { DribbleLoader } from "./DribbleLoader";

const EASE = [0.23, 1, 0.32, 1] as const;

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
    } finally {
      setBusy(false);
    }
  }

  const byId = new Map(questions.map((q) => [q.id, q]));

  return (
    <main style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
      <header style={{ textAlign: "center", paddingTop: 8 }}>
        <p className="eyebrow">{bundle.room.fixture.competition}</p>
        <h1 style={{ fontSize: 24 }}>
          {bundle.room.fixture.homeTeam}{" "}
          <span style={{ color: "var(--amber)" }}>v</span>{" "}
          {bundle.room.fixture.awayTeam}
        </h1>
        {!picks && (
          <p className="muted" style={{ marginTop: 4, fontSize: 13 }}>
            Swipe <span style={{ color: "var(--grass)", fontWeight: 700 }}>right for yes</span>,{" "}
            <span style={{ color: "var(--stamp-bright)", fontWeight: 700 }}>left for no</span>.
          </p>
        )}
      </header>

      {!picks ? (
        <SwipeDeck questions={questions} onDone={setPicks} />
      ) : (
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: EASE }}
          style={{ display: "flex", flexDirection: "column", flex: 1 }}
        >
          {/* the printed slip, ready for the stamp */}
          <div className="slip" style={{ padding: "14px 16px" }}>
            <div style={{ textAlign: "center" }}>
              <p className="display" style={{ fontSize: 22, color: "var(--ink)" }}>
                Called It
              </p>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  color: "var(--ink-soft)",
                  marginTop: 2,
                }}
              >
                OFFICIAL SLIP · ROOM {bundle.room.code} ·{" "}
                {me.displayName.toUpperCase()}
              </p>
            </div>
            <hr className="slip-rule" />
            {picks.map((pick) => {
              const q = byId.get(pick.questionId);
              if (!q) return null;
              const yes = pick.choice === "yes";
              return (
                <div
                  key={pick.questionId}
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 10,
                    padding: "7px 0",
                    borderBottom: "1px dashed rgba(23,21,15,0.18)",
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>
                    {q.text}
                    {q.points === 3 && (
                      <span style={{ color: "var(--ink)", background: "rgba(255,181,32,0.5)", padding: "0 4px", marginLeft: 6, fontSize: 11 }}>
                        3PT
                      </span>
                    )}
                  </span>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: 14,
                      textTransform: "uppercase",
                      color: yes ? "var(--grass-ink)" : "var(--stamp)",
                    }}
                  >
                    {pick.choice}
                  </span>
                </div>
              );
            })}
            <p
              style={{
                marginTop: 8,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.12em",
                color: "var(--ink-soft)",
                textAlign: "center",
              }}
            >
              MAX RETURN 7 PTS · NO CHANGES AFTER THE STAMP
            </p>
          </div>
          <div className="slip-tear" />

          {error && <p className="error-line" style={{ marginTop: 10 }}>{error}</p>}

          <div style={{ marginTop: "auto", display: "flex", gap: 10, paddingTop: 12 }}>
            <button
              className="btn btn-ghost"
              style={{ flex: 1 }}
              onClick={() => setPicks(null)}
              disabled={busy}
            >
              Redo
            </button>
            <button
              className="btn"
              style={{ flex: 2 }}
              onClick={lockIn}
              disabled={busy}
            >
              {busy ? (
                <>
                  <DribbleLoader size="inline" /> Stamping…
                </>
              ) : (
                "Stamp it"
              )}
            </button>
          </div>
        </motion.section>
      )}
    </main>
  );
}
