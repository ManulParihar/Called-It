"use client";

// The bookie. He runs the book for the room: takes the slips, calls the
// action, and reads out who pays at full time. Voice comes later; for now his
// words go on a paper chit next to him.

import { motion, AnimatePresence } from "framer-motion";

export type RefereeMood = "neutral" | "hype" | "alarm" | "celebrate";

const SKIN = "#d9a26b";
const CAP = "#6b5637";
const CHALK = "#f2f4ec";
const INK = "#17150f";

function BookieFigure({ mood }: { mood: RefereeMood }) {
  const leftUp = mood === "celebrate";
  const rightUp = mood === "hype" || mood === "celebrate" || mood === "alarm";

  return (
    <svg viewBox="0 0 120 130" width="92" height="100" role="img" aria-label="the bookie">
      {/* arms: chalk shirt sleeves */}
      <path
        d={leftUp ? "M42 78 C30 66 24 50 28 36" : "M42 78 C30 86 24 96 26 106"}
        fill="none"
        stroke={CHALK}
        strokeWidth="10"
        strokeLinecap="round"
      />
      <path
        d={rightUp ? "M78 78 C90 66 96 50 92 36" : "M78 78 C90 86 96 96 94 106"}
        fill="none"
        stroke={CHALK}
        strokeWidth="10"
        strokeLinecap="round"
      />
      {/* hands */}
      <circle cx={leftUp ? 28 : 26} cy={leftUp ? 34 : 108} r="6" fill={SKIN} />
      <circle cx={rightUp ? 92 : 94} cy={rightUp ? 34 : 108} r="6" fill={SKIN} />
      {/* a slip waved in the raised hand on the big moments */}
      {rightUp && (
        <g transform="rotate(14 98 26)">
          <rect x="90" y="14" width="18" height="24" rx="1.5" fill="#f4efe2" stroke={INK} strokeWidth="1.5" />
          <path d="M93 20 h12 M93 25 h12 M93 30 h8" stroke={INK} strokeWidth="1.4" />
        </g>
      )}
      {/* waistcoat over a chalk shirt collar */}
      <path d="M42 70 C42 62 78 62 78 70 L83 116 C66 124 54 124 37 116 Z" fill={INK} />
      <path d="M52 66 L60 80 L68 66 C63 62 57 62 52 66 Z" fill={CHALK} />
      <path d="M47 74 L51 112 M73 74 L69 112" stroke={CHALK} strokeWidth="1.5" opacity="0.35" />
      {/* head */}
      <circle cx="60" cy="42" r="22" fill={SKIN} />
      {/* ears */}
      <circle cx="38" cy="44" r="4.5" fill={SKIN} />
      <circle cx="82" cy="44" r="4.5" fill={SKIN} />
      {/* pencil behind the ear */}
      <rect x="79" y="30" width="4" height="16" rx="1.5" fill="#ffb520" transform="rotate(18 81 38)" />
      {/* flat cap */}
      <path d="M38 36 C38 20 82 20 82 36 C70 30 50 30 38 36 Z" fill={CAP} />
      <path d="M34 36 C50 28 70 28 86 36 L84 41 C68 34 52 34 36 41 Z" fill={CAP} />
      {/* glasses */}
      <circle cx="51" cy="45" r="7" fill="none" stroke={INK} strokeWidth="2.5" />
      <circle cx="69" cy="45" r="7" fill="none" stroke={INK} strokeWidth="2.5" />
      <path d="M58 45 L62 45" stroke={INK} strokeWidth="2.5" />
      {/* eyes change with the mood */}
      {mood === "alarm" ? (
        <>
          <path d="M48 44 l6 3 M54 44 l-6 3" stroke={INK} strokeWidth="2" strokeLinecap="round" />
          <path d="M72 44 l-6 3 M66 44 l6 3" stroke={INK} strokeWidth="2" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="51" cy="45" r={mood === "neutral" ? 2 : 2.6} fill={INK} />
          <circle cx="69" cy="45" r={mood === "neutral" ? 2 : 2.6} fill={INK} />
        </>
      )}
      {/* moustache and mouth */}
      <path d="M52 56 C56 53 64 53 68 56 C64 58 56 58 52 56 Z" fill="#57523f" />
      {mood === "neutral" ? (
        <path d="M56 61 C58 63 62 63 64 61" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      ) : (
        <ellipse cx="60" cy="62" rx={mood === "alarm" ? 4 : 5.5} ry={mood === "alarm" ? 3 : 4.5} fill={INK} />
      )}
    </svg>
  );
}

export function Referee({
  mood = "neutral",
  line,
}: {
  mood?: RefereeMood;
  line: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
      {/* one pop when the mood turns, then still — no idle loop */}
      <motion.div
        key={mood}
        initial={{ scale: 0.95, y: 4 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", duration: 0.4, bounce: 0.35 }}
        style={{ flexShrink: 0 }}
      >
        <BookieFigure mood={mood} />
      </motion.div>
      <AnimatePresence mode="wait">
        <motion.div
          aria-live="polite"
          key={line}
          initial={{ opacity: 0, scale: 0.96, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
          transition={{ type: "spring", duration: 0.35, bounce: 0.2 }}
          className="slip"
          style={{
            padding: "10px 14px",
            fontSize: 13,
            fontWeight: 700,
            lineHeight: 1.4,
            marginBottom: 22,
            transform: "rotate(-0.6deg)",
            borderRadius: 3,
          }}
        >
          {line}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
