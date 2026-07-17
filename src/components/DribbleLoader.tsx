"use client";

// A chalk footballer dribbling an amber ball. This is the loading state for
// anything that takes a moment (opening a room, joining one, pulling
// fixtures): instead of a grey "Loading..." the player keeps the ball moving.
//
// Same rig style as the referee: fixed paths inside groups that rotate about
// a joint, so the run cycle is a set of angles framer loops between. The legs
// scissor about the hip, the body bobs twice per stride, and the ball spins
// while it bounces between touches. Everything animates transform + opacity
// only. With prefers-reduced-motion the exact same figure renders frozen
// mid-stride, ball at his boot.

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

// One full stride, in seconds. The body bobs and the ball bounces twice per
// stride (once per footfall), the ball spin runs on its own clock.
const STRIDE = 0.72;

function usePrefersReducedMotion(): boolean {
  // Starts false so server and first client render agree; the real preference
  // arrives in the effect after hydration.
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

export function DribbleLoader({
  size = "page",
  label,
}: {
  size?: "page" | "inline";
  label?: string;
}) {
  const reduced = usePrefersReducedMotion();

  if (size === "inline") {
    return (
      <span
        aria-hidden="true"
        style={{
          display: "inline-flex",
          alignItems: "center",
          verticalAlign: "middle",
          lineHeight: 0,
        }}
      >
        <DribbleFigure height={20} reduced={reduced} />
      </span>
    );
  }

  return (
    <div
      role="status"
      aria-label={label ?? "Loading"}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
      }}
    >
      <DribbleFigure height={88} reduced={reduced} />
      {label ? (
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 13,
            letterSpacing: "0.06em",
            color: "var(--chalk-dim)",
          }}
        >
          {label}
        </span>
      ) : null}
    </div>
  );
}

function DribbleFigure({ height, reduced }: { height: number; reduced: boolean }) {
  // Every animated value collapses to its resting frame when reduced, and the
  // transitions collapse to zero duration, so the figure simply stands.
  const loop = { repeat: Infinity, ease: "easeInOut" as const };
  const still = { duration: 0 };

  return (
    <svg
      viewBox="0 0 104 92"
      width={(104 / 92) * height}
      height={height}
      fill="none"
      style={{ display: "block", overflow: "visible" }}
    >
      {/* Chalk touchline he runs along. */}
      <line
        x1="8"
        y1="86"
        x2="96"
        y2="86"
        stroke="var(--chalk-dim)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="10 7"
        opacity="0.35"
      />

      {/* Ball shadow: a chalk smudge that thins as the ball leaves the turf. */}
      <motion.ellipse
        cx="78"
        cy="86"
        rx="7"
        ry="1.6"
        fill="var(--chalk-dim)"
        style={{ originX: 0.5, originY: 0.5 }}
        animate={
          reduced
            ? { scaleX: 1, opacity: 0.3 }
            : { scaleX: [1, 0.6, 1], opacity: [0.3, 0.12, 0.3] }
        }
        transition={reduced ? still : { ...loop, duration: STRIDE / 2 }}
      />

      {/* The player: a chalk stick figure mid-stride, leaning into the run. */}
      <motion.g
        stroke="var(--chalk)"
        strokeLinecap="round"
        strokeLinejoin="round"
        animate={reduced ? { y: 0 } : { y: [0, -2.5, 0, -2.5, 0] }}
        transition={reduced ? still : { ...loop, duration: STRIDE }}
      >
        {/* Head */}
        <circle cx="43" cy="16" r="7" fill="var(--chalk)" stroke="none" />
        {/* Torso, leaning toward the ball */}
        <path d="M 45 25 L 50 48" strokeWidth="6.5" />

        {/* Back arm, trailing. Pivots at the shoulder (top-right of its box). */}
        <motion.g
          style={{ originX: 1, originY: 0 }}
          animate={{ rotate: reduced ? 0 : [-10, 12, -10] }}
          transition={reduced ? still : { ...loop, duration: STRIDE }}
        >
          <path d="M 45 29 L 36 36 L 33 45" strokeWidth="4.5" />
        </motion.g>

        {/* Front arm, pumping. Pivots at the shoulder (top-left of its box). */}
        <motion.g
          style={{ originX: 0, originY: 0 }}
          animate={{ rotate: reduced ? 0 : [10, -12, 10] }}
          transition={reduced ? still : { ...loop, duration: STRIDE }}
        >
          <path d="M 45 29 L 55 34 L 62 29" strokeWidth="4.5" />
        </motion.g>

        {/* Back leg, driving. Pivots at the hip (top-right of its box). */}
        <motion.g
          style={{ originX: 1, originY: 0 }}
          animate={{ rotate: reduced ? 0 : [-14, 16, -14] }}
          transition={reduced ? still : { ...loop, duration: STRIDE }}
        >
          <path d="M 50 48 L 40 61 L 33 76" strokeWidth="5.5" />
        </motion.g>

        {/* Front leg, the one on the ball. Pivots at the hip (top-left). */}
        <motion.g
          style={{ originX: 0, originY: 0 }}
          animate={{ rotate: reduced ? 0 : [14, -16, 14] }}
          transition={reduced ? still : { ...loop, duration: STRIDE }}
        >
          <path d="M 50 48 L 60 60 L 67 73" strokeWidth="5.5" />
        </motion.g>
      </motion.g>

      {/* The ball: outer group bounces along a small arc, inner group spins. */}
      <motion.g
        animate={reduced ? { x: 0, y: 0 } : { x: [0, 3, 0, -3, 0], y: [0, -7, 0] }}
        transition={
          reduced
            ? still
            : {
                x: { ...loop, duration: STRIDE },
                y: { ...loop, duration: STRIDE / 2 },
              }
        }
      >
        <motion.g
          style={{ originX: 0.5, originY: 0.5 }}
          animate={{ rotate: reduced ? 0 : 360 }}
          transition={
            reduced ? still : { repeat: Infinity, ease: "linear", duration: 1.1 }
          }
        >
          <circle
            cx="78"
            cy="78"
            r="8"
            fill="var(--amber)"
            stroke="var(--chalk)"
            strokeWidth="1.5"
          />
          {/* Centre pentagon, so it is unmistakably a football. */}
          <path
            d="M 78 74.6 L 74.8 76.9 L 76 80.7 L 80 80.7 L 81.2 76.9 Z"
            fill="var(--pitch)"
          />
          {/* Stitch marks running from the pentagon out to the seam. */}
          <g stroke="var(--pitch)" strokeWidth="1.2" strokeLinecap="round">
            <line x1="78" y1="74.6" x2="78" y2="71.4" />
            <line x1="74.8" y1="76.9" x2="71.8" y2="75.9" />
            <line x1="81.2" y1="76.9" x2="84.2" y2="75.9" />
            <line x1="76" y1="80.7" x2="74.2" y2="83.4" />
            <line x1="80" y1="80.7" x2="81.8" y2="83.4" />
          </g>
        </motion.g>
      </motion.g>
    </svg>
  );
}
