"use client";

// A full body footballer dribbling along a stadium touchline. This is the
// loading state for anything that takes a moment (opening a room, joining
// one, pulling fixtures): instead of a grey "Loading..." the player keeps
// the ball moving.
//
// Same rig style as the referee: fixed filled shapes inside groups that
// rotate about a joint, so the run cycle is a set of angles framer loops
// between. Legs are two segments (hip and knee) so the trailing leg folds
// while the leading one reaches for the ball. The body bobs twice per
// stride, the arms pump opposite the legs, and the ball spins on its own
// clock while it bounces between touches. Everything animates transform and
// opacity only. With prefers-reduced-motion the same figure renders frozen
// mid-stride, ball at his boot, backdrop still.

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

// One full stride, in seconds. The body bobs and the ball bounces twice per
// stride (once per footfall); the ball spin runs on its own clock.
const STRIDE = 0.72;
const SPIN = 1.1;

const CHALK = "var(--chalk)";
const CHALK_DIM = "var(--chalk-dim)";
const CHALK_LINE = "var(--chalk-line)";
const GRASS = "var(--grass)";
const AMBER = "var(--amber)";
const INK = "var(--ink)";
const PITCH_2 = "var(--pitch-2)";
const PITCH_3 = "var(--pitch-3)";

// Joints for the page figure, in viewBox coordinates. Every limb is drawn in
// its rest position and rotated about one of these.
const HIP = { x: 61, y: 66 };
const F_KNEE = { x: 66, y: 81 };
const B_KNEE = { x: 57, y: 81 };
const F_SHOULDER = { x: 68.6, y: 43 };
const B_SHOULDER = { x: 58, y: 44.5 };

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
        <InlineFigure height={20} reduced={reduced} />
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

// A joint pivot in viewBox coordinates, matching the referee rig.
function pivot(x: number, y: number) {
  return {
    transformBox: "view-box",
    transformOrigin: `${x}px ${y}px`,
  } as const;
}

function Floodlight({ x }: { x: number }) {
  return (
    <g transform={`translate(${x} 0)`} opacity="0.55">
      <line x1="0" y1="16" x2="0" y2="9.5" stroke={CHALK_DIM} strokeWidth="1.4" />
      <rect
        x="-5.5"
        y="3.5"
        width="11"
        height="6"
        rx="1.2"
        fill={PITCH_3}
        stroke={CHALK_DIM}
        strokeWidth="1"
      />
      <circle cx="-2.6" cy="6.5" r="0.8" fill={CHALK} />
      <circle cx="0" cy="6.5" r="0.8" fill={CHALK} />
      <circle cx="2.6" cy="6.5" r="0.8" fill={CHALK} />
    </g>
  );
}

function DribbleFigure({ height, reduced }: { height: number; reduced: boolean }) {
  // Every animated value collapses to its first keyframe when reduced, and
  // the transitions collapse to zero duration, so the figure holds one
  // mid-stride frame with the ball at his boot.
  const loop = { repeat: Infinity, ease: "easeInOut" as const };
  const still = { duration: 0 };
  const stride = reduced ? still : { ...loop, duration: STRIDE };
  const halfStride = reduced ? still : { ...loop, duration: STRIDE / 2 };
  const swing = (a: number, b: number) => ({ rotate: reduced ? a : [a, b, a] });

  return (
    <svg
      viewBox="0 0 150 112"
      width={(150 / 112) * height}
      height={height}
      fill="none"
      style={{ display: "block", overflow: "visible" }}
    >
      {/* Stadium backdrop: floodlights over a single dark tier of stand. The
          dashed rows read as crowd at this size without drawing anyone. */}
      <Floodlight x={27} />
      <Floodlight x={123} />
      <rect x="8" y="16" width="134" height="18" rx="2.5" fill={PITCH_3} />
      <line
        x1="14"
        y1="22.5"
        x2="136"
        y2="22.5"
        stroke={CHALK_LINE}
        strokeWidth="2.5"
        strokeDasharray="2 4"
      />
      <line
        x1="14"
        y1="29"
        x2="136"
        y2="29"
        stroke={CHALK_LINE}
        strokeWidth="2.5"
        strokeDasharray="2 4"
        strokeDashoffset="3"
      />

      {/* The pitch: mowed stripes and a chalk touchline with the edge of the
          centre circle behind him. */}
      <rect x="2" y="34" width="146" height="62" rx="2" fill={PITCH_2} />
      <g fill={GRASS} opacity="0.07">
        <rect x="2" y="34" width="18.25" height="62" />
        <rect x="38.5" y="34" width="18.25" height="62" />
        <rect x="75" y="34" width="18.25" height="62" />
        <rect x="111.5" y="34" width="18.25" height="62" />
      </g>
      <path d="M 16 96 A 22 22 0 0 1 58 96" stroke={CHALK_LINE} strokeWidth="2" />
      <line
        x1="6"
        y1="96"
        x2="144"
        y2="96"
        stroke={CHALK}
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.4"
      />

      {/* Ball shadow: a chalk smudge that thins as the ball leaves the turf. */}
      <motion.ellipse
        cx="88"
        cy="96.3"
        rx="7"
        ry="1.5"
        fill={CHALK_DIM}
        style={{ originX: 0.5, originY: 0.5 }}
        animate={
          reduced
            ? { scaleX: 1, opacity: 0.3 }
            : { scaleX: [1, 0.6, 1], opacity: [0.3, 0.12, 0.3] }
        }
        transition={halfStride}
      />

      {/* The player, mid-stride and leaning into the run. The outer group is
          the bob: down on each footfall, so twice per stride. */}
      <motion.g
        animate={reduced ? { y: 0 } : { y: [0, -2.6, 0, -2.6, 0] }}
        transition={stride}
      >
        {/* Back arm, on the far side, pumping opposite the front leg. */}
        <motion.g
          opacity="0.9"
          style={pivot(B_SHOULDER.x, B_SHOULDER.y)}
          animate={swing(-16, 14)}
          transition={stride}
        >
          <path
            d="M 58 44.5 L 55.2 51.5"
            stroke={GRASS}
            strokeWidth="6.4"
            strokeLinecap="round"
          />
          <path
            d="M 55.4 51 C 54 56 54.8 60.4 57.6 63.4"
            stroke={CHALK_DIM}
            strokeWidth="4.4"
            strokeLinecap="round"
          />
          <circle cx="57.8" cy="63.6" r="2.7" fill={CHALK_DIM} />
        </motion.g>

        {/* Back leg, trailing with a folded knee. Thigh rotates at the hip,
            shin and boot at the knee. */}
        <motion.g
          opacity="0.85"
          style={pivot(HIP.x, HIP.y)}
          animate={swing(16, -18)}
          transition={stride}
        >
          <path
            d="M 61 66 L 57 81"
            stroke={CHALK_DIM}
            strokeWidth="7"
            strokeLinecap="round"
          />
          <motion.g
            style={pivot(B_KNEE.x, B_KNEE.y)}
            animate={swing(42, 2)}
            transition={stride}
          >
            <path
              d="M 57 81 L 54 93"
              stroke={CHALK_DIM}
              strokeWidth="5.5"
              strokeLinecap="round"
            />
            <path
              d="M 56.3 84.2 L 54.2 93"
              stroke={GRASS}
              strokeWidth="6"
              strokeLinecap="round"
            />
            <path d="M 55 83.8 L 58.2 84.6" stroke={CHALK} strokeWidth="2" strokeLinecap="round" />
            <path
              d="M 51.6 90.6 L 55.8 90 C 60.6 90 62.8 92.2 62.3 94.8 C 59 95.6 54.6 95.7 51.9 95.2 Z"
              fill={AMBER}
            />
            <path d="M 52.4 95.1 L 62 94.7" stroke={INK} strokeWidth="1.2" strokeLinecap="round" />
          </motion.g>
        </motion.g>

        {/* Front leg, the one on the ball. Frozen pose holds it reaching
            forward with the boot at the ball. */}
        <motion.g
          style={pivot(HIP.x, HIP.y)}
          animate={swing(-18, 16)}
          transition={stride}
        >
          <path
            d="M 61 66 L 66 81"
            stroke={CHALK}
            strokeWidth="7"
            strokeLinecap="round"
          />
          <motion.g
            style={pivot(F_KNEE.x, F_KNEE.y)}
            animate={swing(2, 42)}
            transition={stride}
          >
            <path
              d="M 66 81 L 69 93"
              stroke={CHALK}
              strokeWidth="5.5"
              strokeLinecap="round"
            />
            <path
              d="M 66.9 84.2 L 69 93"
              stroke={GRASS}
              strokeWidth="6"
              strokeLinecap="round"
            />
            <path d="M 65.4 84.6 L 68.6 83.8" stroke={CHALK} strokeWidth="2" strokeLinecap="round" />
            <path
              d="M 66.6 90.6 L 70.8 90 C 75.6 90 77.8 92.2 77.3 94.8 C 74 95.6 69.6 95.7 66.9 95.2 Z"
              fill={AMBER}
            />
            <path d="M 67.4 95.1 L 77 94.7" stroke={INK} strokeWidth="1.2" strokeLinecap="round" />
          </motion.g>
        </motion.g>

        {/* Jersey: a filled kit torso leaning toward the ball, chalk trim at
            the collar and hem, squad number on the chest. */}
        <path
          d="M 56.6 45.5 C 55.8 41.8 60.4 39.6 65 39.8 C 68.6 40 71.4 41.8 71 44.6 L 68.4 63 C 64.2 65.2 58.6 65.4 55 63 Z"
          fill={GRASS}
        />
        <path
          d="M 63.4 40.2 L 65 42.6 L 66.8 40.4"
          stroke={CHALK}
          strokeWidth="1.3"
          strokeLinecap="round"
        />
        <path
          d="M 55.4 61.4 C 59 63.6 64.6 63.4 68.1 61.4"
          stroke={CHALK}
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.8"
        />
        <text
          x="62.6"
          y="56"
          fontSize="8.5"
          fontWeight="700"
          fill={CHALK}
          textAnchor="middle"
          transform="rotate(-4 62.6 56)"
        >
          9
        </text>

        {/* Shorts over the hip joint, split between the legs, with a kit
            stripe down the near side. */}
        <path
          d="M 54.6 61.5 L 69.3 60 L 71.2 72.8 L 63.5 73.6 L 61.5 67.8 L 58.2 74.2 L 52.9 73 Z"
          fill={CHALK}
        />
        <path d="M 69.6 61.5 L 71 72" stroke={GRASS} strokeWidth="1.4" strokeLinecap="round" />

        {/* Front arm, pumping across the chest. */}
        <motion.g
          style={pivot(F_SHOULDER.x, F_SHOULDER.y)}
          animate={swing(14, -16)}
          transition={stride}
        >
          <path
            d="M 68.6 43 L 71.4 49.8"
            stroke={GRASS}
            strokeWidth="6.4"
            strokeLinecap="round"
          />
          <path
            d="M 71.2 49.6 C 73.6 53.8 76.6 55.9 80 56.4"
            stroke={CHALK}
            strokeWidth="4.4"
            strokeLinecap="round"
          />
          <circle cx="80.2" cy="56.5" r="2.7" fill={CHALK} />
        </motion.g>

        {/* Head: chalk face, ink hair swept back by the run, one eye on the
            ball. */}
        <path d="M 68.8 36.5 L 67.6 41.5" stroke={CHALK} strokeWidth="4.5" strokeLinecap="round" />
        <circle cx="72" cy="30" r="8" fill={CHALK} />
        <path
          d="M 64.3 28.5 C 64.8 22.8 71.5 20.9 76 23.6 C 78.3 25 79.7 27.4 79.9 29.6 C 76.5 25.8 69.5 25.4 64.3 28.5 Z"
          fill={INK}
        />
        <circle cx="75.6" cy="29.6" r="1.1" fill={INK} />
      </motion.g>

      {/* The ball: outer group bounces along a small arc, inner group spins. */}
      <motion.g
        animate={reduced ? { x: 0, y: 0 } : { x: [0, 4, 0, -4, 0], y: [0, -7, 0] }}
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
          transition={reduced ? still : { repeat: Infinity, ease: "linear", duration: SPIN }}
        >
          <circle cx="88" cy="88" r="8" fill={AMBER} stroke={CHALK} strokeWidth="1.5" />
          {/* Centre pentagon, so it is unmistakably a football. */}
          <path d="M 88 84.6 L 84.8 86.9 L 86 90.7 L 90 90.7 L 91.2 86.9 Z" fill={INK} />
          {/* Stitch marks running from the pentagon out to the seam. */}
          <g stroke={INK} strokeWidth="1.2" strokeLinecap="round">
            <line x1="88" y1="84.6" x2="88" y2="81.4" />
            <line x1="84.8" y1="86.9" x2="81.8" y2="85.9" />
            <line x1="91.2" y1="86.9" x2="94.2" y2="85.9" />
            <line x1="86" y1="90.7" x2="84.2" y2="93.4" />
            <line x1="90" y1="90.7" x2="91.8" y2="93.4" />
          </g>
        </motion.g>
      </motion.g>
    </svg>
  );
}

// The button-sized version: the player and ball only, no backdrop. Simplified
// shapes, but still a filled kit silhouette rather than a stick figure.
function InlineFigure({ height, reduced }: { height: number; reduced: boolean }) {
  const loop = { repeat: Infinity, ease: "easeInOut" as const };
  const still = { duration: 0 };
  const stride = reduced ? still : { ...loop, duration: STRIDE };
  const swing = (a: number, b: number) => ({ rotate: reduced ? a : [a, b, a] });

  return (
    <svg
      viewBox="0 0 25 24"
      width={(25 / 24) * height}
      height={height}
      fill="none"
      style={{ display: "block", overflow: "visible" }}
    >
      <motion.g
        animate={reduced ? { y: 0 } : { y: [0, -0.9, 0, -0.9, 0] }}
        transition={stride}
      >
        {/* Back arm and back leg on the far side, slightly dimmed. */}
        <motion.g
          style={pivot(10.2, 8.4)}
          animate={swing(-16, 14)}
          transition={stride}
        >
          <path d="M 10.2 8.4 L 7.9 11.6" stroke={CHALK_DIM} strokeWidth="1.9" strokeLinecap="round" />
        </motion.g>
        <motion.g
          style={pivot(10.8, 13.2)}
          animate={swing(14, -16)}
          transition={stride}
        >
          <path d="M 10.8 13.2 L 8.4 20.4" stroke={CHALK_DIM} strokeWidth="2.3" strokeLinecap="round" />
          <circle cx="8.3" cy="20.5" r="1.4" fill={AMBER} />
        </motion.g>

        {/* Front leg, reaching for the ball. */}
        <motion.g
          style={pivot(10.8, 13.2)}
          animate={swing(-16, 14)}
          transition={stride}
        >
          <path d="M 10.8 13.2 L 13.4 20.3" stroke={CHALK} strokeWidth="2.3" strokeLinecap="round" />
          <circle cx="13.5" cy="20.4" r="1.4" fill={AMBER} />
        </motion.g>

        {/* Jersey torso, front arm, then the head with its ink hair. */}
        <path d="M 9.9 7.4 L 11.2 13" stroke={GRASS} strokeWidth="5.2" strokeLinecap="round" />
        <motion.g
          style={pivot(10.9, 8.4)}
          animate={swing(14, -16)}
          transition={stride}
        >
          <path d="M 10.9 8.4 L 13.6 11.3" stroke={CHALK} strokeWidth="1.9" strokeLinecap="round" />
        </motion.g>
        <circle cx="11.3" cy="3.8" r="2.8" fill={CHALK} />
        <path
          d="M 8.8 3.2 C 9.7 1.2 12.9 1 14 3 C 12.4 2 10.4 2.1 8.8 3.2 Z"
          fill={INK}
        />
      </motion.g>

      {/* The ball: bounce outside, spin inside. */}
      <motion.g
        animate={reduced ? { x: 0, y: 0 } : { x: [0, 1.6, 0, -1.6, 0], y: [0, -2.8, 0] }}
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
          transition={reduced ? still : { repeat: Infinity, ease: "linear", duration: SPIN }}
        >
          <circle cx="19.6" cy="19" r="2.9" fill={AMBER} stroke={CHALK} strokeWidth="0.8" />
          <circle cx="19.6" cy="17.7" r="1" fill={INK} />
        </motion.g>
      </motion.g>
    </svg>
  );
}
