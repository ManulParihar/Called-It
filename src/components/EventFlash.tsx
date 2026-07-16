"use client";

// Full screen reactions to the big match moments. A goal slams "GOOOAL!"
// across the screen, a red card floods it red, and so on. The live screen
// feeds this one event at a time.

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
  color: string;
  wash: string; // full screen tint
  confetti?: boolean;
}

function lookFor(spec: FlashSpec): Look | null {
  switch (spec.kind) {
    case "goal":
      return {
        word: "GOOOAL!",
        sub: spec.teamName ?? undefined,
        color: "var(--lime)",
        wash: "rgba(200,245,39,0.16)",
        confetti: true,
      };
    case "red_card":
      return {
        word: "RED CARD!",
        sub: spec.teamName ?? undefined,
        color: "var(--danger)",
        wash: "rgba(255,66,66,0.22)",
      };
    case "penalty_awarded":
      return {
        word: "PENALTY!",
        sub: spec.teamName ?? undefined,
        color: "var(--tangerine)",
        wash: "rgba(255,140,26,0.18)",
      };
    case "var_review":
      return {
        word: "VAR CHECK",
        sub: "hold your breath",
        color: "var(--sky)",
        wash: "rgba(63,216,232,0.14)",
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
        particleCount: 90,
        spread: 75,
        origin: { y: 0.6 },
        colors: ["#c8f527", "#ff2e88", "#ffcf3f", "#fff3e2"],
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
          exit={{ opacity: 0 }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: look.wash,
            backdropFilter: "blur(2px)",
            pointerEvents: "none",
          }}
        >
          <motion.p
            className="display"
            initial={{ scale: 3, rotate: -6, opacity: 0 }}
            animate={{ scale: 1, rotate: -3, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 16 }}
            style={{
              fontSize: 54,
              color: look.color,
              textShadow: `0 0 40px ${look.color}, 0 6px 0 rgba(0,0,0,0.5)`,
              textAlign: "center",
            }}
          >
            {look.word}
          </motion.p>
          {look.sub && (
            <motion.p
              className="display"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15 }}
              style={{ fontSize: 20, color: "var(--cream)" }}
            >
              {look.sub}
            </motion.p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
