"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const SIZE = 44; // disc diameter, px
const RING = 36; // svg viewbox size
const R = 15; // circle radius
const STROKE = 3;
const CIRCUMFERENCE = 2 * Math.PI * R;

/**
 * Small fixed countdown ring, top-right. The amber stroke depletes linearly
 * over `seconds` like a clock winding down; the parent bumps `cycle` to
 * restart it for each new moment.
 */
export function MomentRing({
  show,
  cycle,
  seconds = 3,
  right = 12,
}: {
  show: boolean;
  cycle: number;
  seconds?: number;
  // Distance from the right edge, in px. Callers that also pin something
  // else to the top-right (like a menu button) can shift the ring out of
  // its way.
  right?: number;
}) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [remaining, setRemaining] = useState(seconds);

  // Hydration-safe reduced-motion read.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Whole-seconds countdown, restarted every cycle. No leaked intervals:
  // cleared on cycle change and unmount.
  useEffect(() => {
    setRemaining(seconds);
    const startedAt = Date.now();
    const id = window.setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      const left = Math.max(0, Math.ceil(seconds - elapsed));
      setRemaining(left);
      if (left <= 0) window.clearInterval(id);
    }, 200);
    return () => window.clearInterval(id);
  }, [cycle, seconds]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.7 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          style={{
            position: "fixed",
            top: "calc(12px + env(safe-area-inset-top))",
            right: `calc(${right}px + env(safe-area-inset-right))`,
            zIndex: 55,
            pointerEvents: "none",
            width: SIZE,
            height: SIZE,
            borderRadius: "50%",
            background: "var(--pitch-2)",
            border: "1px solid var(--chalk-line, var(--chalk-dim))",
            boxShadow: "0 2px 10px var(--pitch)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg
            width={RING}
            height={RING}
            viewBox={`0 0 ${RING} ${RING}`}
            style={{ position: "absolute", inset: (SIZE - RING) / 2 }}
            aria-hidden="true"
          >
            {/* faint track */}
            <circle
              cx={RING / 2}
              cy={RING / 2}
              r={R}
              fill="none"
              stroke="var(--chalk-dim)"
              strokeOpacity={0.25}
              strokeWidth={STROKE}
            />
            {/* depleting amber sweep — starts at 12 o'clock */}
            {reducedMotion ? (
              <circle
                cx={RING / 2}
                cy={RING / 2}
                r={R}
                fill="none"
                stroke="var(--amber)"
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={0}
                transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
              />
            ) : (
              <motion.circle
                key={cycle}
                cx={RING / 2}
                cy={RING / 2}
                r={R}
                fill="none"
                stroke="var(--amber)"
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                initial={{ strokeDashoffset: 0 }}
                animate={{ strokeDashoffset: CIRCUMFERENCE }}
                transition={{ duration: seconds, ease: "linear" }}
                transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
              />
            )}
          </svg>
          <span
            style={{
              position: "relative",
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              fontWeight: 700,
              lineHeight: 1,
              color: "var(--chalk)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {remaining}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
