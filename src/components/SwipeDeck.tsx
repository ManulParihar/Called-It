"use client";

// The prediction deck. Each call is printed on a paper slip: swipe right to
// stamp it YES, left to stamp it NO. The three point call sits last and gets
// the ink-and-amber banner.

import { useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
} from "framer-motion";
import type { Question, Swipe } from "@/lib/types";

const SWIPE_DISTANCE = 90;
const SWIPE_VELOCITY = 600;

function TopCard({
  question,
  index,
  total,
  onSwipe,
}: {
  question: Question;
  index: number;
  total: number;
  onSwipe: (choice: Swipe) => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-12, 12]);
  const yesOpacity = useTransform(x, [20, 110], [0, 1]);
  const noOpacity = useTransform(x, [-110, -20], [1, 0]);
  const big = question.points === 3;

  return (
    <motion.div
      drag="x"
      dragElastic={0.8}
      dragMomentum={false}
      style={{
        x,
        rotate,
        position: "absolute",
        inset: 0,
        touchAction: "pan-y",
        cursor: "grab",
        display: "flex",
        flexDirection: "column",
      }}
      onDragEnd={(_e, info) => {
        const gone =
          Math.abs(info.offset.x) > SWIPE_DISTANCE ||
          Math.abs(info.velocity.x) > SWIPE_VELOCITY;
        if (!gone) return;
        onSwipe(info.offset.x > 0 || info.velocity.x > 0 ? "yes" : "no");
      }}
      whileTap={{ cursor: "grabbing" }}
    >
      <div
        className="slip"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: "14px 16px",
          position: "relative",
        }}
      >
        {/* printed header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.12em",
            color: "var(--ink-soft)",
          }}
        >
          <span>CALLED IT · OFFICIAL CALL</span>
          <span>
            {index + 1}/{total}
          </span>
        </div>
        <hr className="slip-rule" />

        {big && (
          <p
            style={{
              alignSelf: "center",
              background: "var(--ink)",
              color: "var(--amber)",
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: "0.18em",
              padding: "4px 12px",
              borderRadius: 3,
              marginBottom: 10,
            }}
          >
            ★ 3-POINT CALL ★
          </p>
        )}

        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <p
            className="display"
            style={{
              fontSize: big ? 30 : 27,
              textAlign: "center",
              lineHeight: 1.15,
              color: "var(--ink)",
            }}
          >
            {question.text}
          </p>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.1em",
            color: "var(--ink-soft)",
          }}
        >
          <span>← NO</span>
          <span>{big ? "PAYS 3 PTS" : "PAYS 1 PT"}</span>
          <span>YES →</span>
        </div>

        {/* rubber stamps that ink in as you drag */}
        <motion.span
          className="stamp"
          style={{
            opacity: yesOpacity,
            position: "absolute",
            top: 34,
            left: 16,
            fontSize: 24,
            color: "var(--grass-ink)",
          }}
        >
          Yes
        </motion.span>
        <motion.span
          className="stamp"
          style={{
            opacity: noOpacity,
            position: "absolute",
            top: 34,
            right: 16,
            fontSize: 24,
            color: "var(--stamp)",
            transform: "rotate(6deg)",
          }}
        >
          No
        </motion.span>
      </div>
      <div className="slip-tear" />
    </motion.div>
  );
}

export function SwipeDeck({
  questions,
  onDone,
}: {
  questions: Question[];
  onDone: (picks: { questionId: string; choice: Swipe }[]) => void;
}) {
  const [index, setIndex] = useState(0);
  const [picks, setPicks] = useState<{ questionId: string; choice: Swipe }[]>([]);
  const [lastChoice, setLastChoice] = useState<Swipe | null>(null);

  const current = questions[index];
  const next = questions[index + 1];

  function swipe(choice: Swipe) {
    if (!current) return;
    const nextPicks = [...picks, { questionId: current.id, choice }];
    setPicks(nextPicks);
    setLastChoice(choice);
    setIndex(index + 1);
    if (nextPicks.length === questions.length) onDone(nextPicks);
  }

  function undo() {
    if (picks.length === 0 || index === 0) return;
    setPicks(picks.slice(0, -1));
    setIndex(index - 1);
    setLastChoice(null);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
      {/* the book so far: one square per call */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 8,
        }}
      >
        {questions.map((q, i) => (
          <motion.span
            key={q.id}
            animate={{
              background:
                i < index
                  ? picks[i]?.choice === "yes"
                    ? "var(--grass)"
                    : "var(--stamp-bright)"
                  : i === index
                    ? "var(--chalk)"
                    : "transparent",
            }}
            transition={{ duration: 0.15 }}
            style={{
              width: q.points === 3 ? 18 : 10,
              height: 10,
              borderRadius: 2,
              border:
                q.points === 3
                  ? "1px solid var(--amber)"
                  : "1px solid var(--chalk-line)",
            }}
          />
        ))}
      </div>

      <div style={{ position: "relative", flex: 1, minHeight: 320 }}>
        {/* the next slip in the book, peeking out */}
        {next && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 3,
              background: "var(--paper-2)",
              transform: "scale(0.95) translateY(12px)",
            }}
          />
        )}
        <AnimatePresence>
          {current && (
            <motion.div
              key={current.id}
              initial={{ scale: 0.95, y: 12, opacity: 0.85 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              exit={{
                x: lastChoice === "no" ? -420 : 420,
                rotate: lastChoice === "no" ? -18 : 18,
                opacity: 0,
                transition: { duration: 0.25, ease: [0.23, 1, 0.32, 1] },
              }}
              style={{ position: "absolute", inset: 0 }}
            >
              <TopCard
                question={current}
                index={index}
                total={questions.length}
                onSwipe={swipe}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* tap fallback for anyone who would rather press than fling */}
      {current && (
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            className="btn btn-ghost"
            style={{ color: "var(--stamp-bright)", borderColor: "rgba(240,89,74,0.4)", flex: 1 }}
            onClick={() => swipe("no")}
          >
            No
          </button>
          {index > 0 && (
            <button
              className="btn btn-ghost btn-small"
              onClick={undo}
              aria-label="undo last swipe"
            >
              Undo
            </button>
          )}
          <button
            className="btn btn-ghost"
            style={{ color: "var(--grass)", borderColor: "rgba(69,178,107,0.4)", flex: 1 }}
            onClick={() => swipe("yes")}
          >
            Yes
          </button>
        </div>
      )}
    </div>
  );
}
