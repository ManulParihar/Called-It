"use client";

// Full screen reactions to the big match moments. A goal slams a back-page
// headline across the screen; a red card throws the actual card. The live
// screen feeds this one event at a time.

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";

export interface FlashSpec {
  key: number; // unique per event so repeat kinds still animate
  kind: string;
  teamName: string | null;
}

interface Look {
  word: string;
  sub?: string;
  ink: string; // headline colour on the paper strip
  wash: string; // full screen tint
  confetti?: boolean;
  redCard?: boolean;
}

function lookFor(spec: FlashSpec): Look | null {
  switch (spec.kind) {
    case "goal":
      return {
        word: "GOOOAL!",
        sub: spec.teamName ?? undefined,
        ink: "var(--grass-ink)",
        wash: "rgba(69,178,107,0.18)",
        confetti: true,
      };
    case "red_card":
      return {
        word: "RED CARD",
        sub: spec.teamName ?? undefined,
        ink: "var(--stamp)",
        wash: "rgba(215,48,31,0.22)",
        redCard: true,
      };
    case "penalty_awarded":
      return {
        word: "PENALTY!",
        sub: spec.teamName ?? undefined,
        ink: "var(--ink)",
        wash: "rgba(255,181,32,0.16)",
      };
    case "var_review":
      return {
        word: "VAR CHECK",
        sub: "nobody touch their slip",
        ink: "var(--ink)",
        wash: "rgba(242,244,236,0.1)",
      };
    default:
      return null;
  }
}

export function EventFlash({
  flash,
  onDone,
}: {
  flash: FlashSpec | null;
  onDone: () => void;
}) {
  const look = flash ? lookFor(flash) : null;

  useEffect(() => {
    if (!flash || !look) return;
    if (look.confetti) {
      confetti({
        particleCount: 110,
        spread: 80,
        origin: { y: 0.6 },
        colors: ["#f2f4ec", "#ffb520", "#45b26b", "#f4efe2"],
      });
    }
    const timer = setTimeout(onDone, 2200);
    return () => clearTimeout(timer);
    // A new flash restarts the clock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flash?.key]);

  return (
    <AnimatePresence>
      {flash && look && (
        <motion.div
          key={flash.key}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
          transition={{ duration: 0.15 }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
            background: look.wash,
            pointerEvents: "none",
          }}
        >
          {look.redCard && (
            <motion.div
              aria-hidden
              initial={{ opacity: 0, y: 40, rotate: -20 }}
              animate={{ opacity: 1, y: 0, rotate: 8 }}
              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
              style={{
                width: 74,
                height: 104,
                borderRadius: 8,
                background: "var(--stamp)",
                boxShadow: "0 4px 0 rgba(0,0,0,0.4)",
              }}
            />
          )}
          {/* back-page headline strip */}
          <motion.div
            initial={{ scale: 1.35, rotate: -6, opacity: 0 }}
            animate={{ scale: 1, rotate: -3, opacity: 1 }}
            transition={{ type: "spring", duration: 0.4, bounce: 0.3 }}
            className="slip"
            style={{ padding: "8px 22px", borderRadius: 3 }}
          >
            <p
              className="display"
              style={{
                fontSize: 48,
                lineHeight: 1.05,
                color: look.ink,
                textAlign: "center",
              }}
            >
              {look.word}
            </p>
          </motion.div>
          {look.sub && (
            <motion.p
              initial={{ y: 14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.12, duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
              style={{
                fontFamily: "var(--font-mono)",
                fontWeight: 700,
                fontSize: 16,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--chalk)",
                textShadow: "0 1px 0 rgba(0,0,0,0.6)",
              }}
            >
              {look.sub}
            </motion.p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
