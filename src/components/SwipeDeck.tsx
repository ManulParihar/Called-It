"use client";

// The prediction deck. One card per question, swipe right for yes and left
// for no. The three point card sits last and gets the gold treatment.

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
  onSwipe,
}: {
  question: Question;
  onSwipe: (choice: Swipe) => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-14, 14]);
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
        borderRadius: 24,
        background: big
          ? "linear-gradient(160deg, #3a2408, #241238 70%)"
          : "var(--night-2)",
        border: big
          ? "3px solid var(--gold)"
          : "2px solid rgba(255,243,226,0.14)",
        boxShadow: big
          ? "0 8px 0 rgba(0,0,0,0.45), 0 0 40px rgba(255,207,63,0.4)"
          : "0 8px 0 rgba(0,0,0,0.45)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        touchAction: "pan-y",
        cursor: "grab",
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
      {big && (
        <motion.p
          className="display"
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 1.2, repeat: Infinity }}
          style={{
            color: "var(--gold)",
            fontSize: 16,
            letterSpacing: "0.2em",
            textShadow: "0 0 16px rgba(255,207,63,0.6)",
            marginBottom: 12,
          }}
        >
          ★ 3 point call ★
        </motion.p>
      )}
      <p
        className="display"
        style={{
          fontSize: big ? 30 : 26,
          textAlign: "center",
          lineHeight: 1.2,
          color: "var(--cream)",
        }}
      >
        {question.text}
      </p>
      {!big && (
        <p className="eyebrow" style={{ marginTop: 14 }}>
          1 point
        </p>
      )}

      {/* stamps that fade in as you drag */}
      <motion.span
        className="display"
        style={{
          opacity: yesOpacity,
          position: "absolute",
          top: 22,
          left: 20,
          rotate: -14,
          color: "var(--lime)",
          border: "3px solid var(--lime)",
          borderRadius: 10,
          padding: "4px 12px",
          fontSize: 26,
        }}
      >
        Yes
      </motion.span>
      <motion.span
        className="display"
        style={{
          opacity: noOpacity,
          position: "absolute",
          top: 22,
          right: 20,
          rotate: 14,
          color: "var(--danger)",
          border: "3px solid var(--danger)",
          borderRadius: 10,
          padding: "4px 12px",
          fontSize: 26,
        }}
      >
        No
      </motion.span>
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
      {/* progress dots */}
      <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
        {questions.map((q, i) => (
          <motion.span
            key={q.id}
            animate={{
              background:
                i < index
                  ? picks[i]?.choice === "yes"
                    ? "var(--lime)"
                    : "var(--danger)"
                  : i === index
                    ? "var(--cream)"
                    : "var(--night-3)",
              scale: i === index ? 1.25 : 1,
            }}
            style={{
              width: q.points === 3 ? 16 : 10,
              height: 10,
              borderRadius: 6,
              border: q.points === 3 ? "1px solid var(--gold)" : "none",
            }}
          />
        ))}
      </div>

      <div style={{ position: "relative", flex: 1, minHeight: 320 }}>
        {/* the card underneath, peeking out */}
        {next && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 24,
              background: "var(--night-3)",
              border: "2px solid rgba(255,243,226,0.08)",
              transform: "scale(0.94) translateY(14px)",
            }}
          />
        )}
        <AnimatePresence>
          {current && (
            <motion.div
              key={current.id}
              initial={{ scale: 0.94, y: 14, opacity: 0.8 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{
                x: lastChoice === "no" ? -420 : 420,
                rotate: lastChoice === "no" ? -20 : 20,
                opacity: 0,
                transition: { duration: 0.25 },
              }}
              style={{ position: "absolute", inset: 0 }}
            >
              <TopCard question={current} onSwipe={swipe} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* tap fallback for anyone who would rather press than fling */}
      {current && (
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            className="btn btn-ghost"
            style={{ color: "var(--danger)", flex: 1 }}
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
            style={{ color: "var(--lime)", flex: 1 }}
            onClick={() => swipe("yes")}
          >
            Yes
          </button>
        </div>
      )}
    </div>
  );
}
