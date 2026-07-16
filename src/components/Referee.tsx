"use client";

// Rico the referee, the masked host of the show. He stands on the live and
// full time screens, reacts to the match, and reads out the loser's forfeit.
// Voice comes later; for now his words go in the speech bubble.

import { motion, AnimatePresence } from "framer-motion";

export type RefereeMood = "neutral" | "hype" | "alarm" | "celebrate";

function RefereeFigure({ mood }: { mood: RefereeMood }) {
  // Arms change with the mood: down when calm, up for a big moment,
  // one arm pointing for an alarm.
  const leftArmUp = mood === "hype" || mood === "celebrate";
  const rightArmUp = mood === "hype" || mood === "celebrate" || mood === "alarm";

  return (
    <svg viewBox="0 0 120 130" width="96" height="104" role="img" aria-label="the referee">
      {/* arms */}
      <path
        d={leftArmUp ? "M38 72 C24 60 18 44 22 32" : "M38 72 C26 80 20 92 22 102"}
        fill="none"
        stroke="#180a26"
        strokeWidth="11"
        strokeLinecap="round"
      />
      <path
        d={rightArmUp ? "M82 72 C96 60 102 44 98 32" : "M82 72 C94 80 100 92 98 102"}
        fill="none"
        stroke="#180a26"
        strokeWidth="11"
        strokeLinecap="round"
      />
      {/* gloves */}
      <circle cx={leftArmUp ? 22 : 22} cy={leftArmUp ? 30 : 104} r="7" fill="#ff2e88" />
      <circle cx={rightArmUp ? 98 : 98} cy={rightArmUp ? 30 : 104} r="7" fill="#ff2e88" />
      {/* striped shirt */}
      <path d="M38 66 C38 56 82 56 82 66 L86 112 C70 120 50 120 34 112 Z" fill="#fff3e2" />
      <path d="M44 60 L48 116 M56 58 L58 118 M66 58 L64 118 M76 60 L72 116" stroke="#180a26" strokeWidth="6" />
      {/* head with a magenta lucha mask */}
      <path
        d="M60 6 C44 6 38 18 38 32 C38 48 48 60 60 62 C72 60 82 48 82 32 C82 18 76 6 60 6 Z"
        fill="#ff2e88"
        stroke="#180a26"
        strokeWidth="3"
      />
      <path d="M60 10 L68 22 L60 34 L52 22 Z" fill="#ffcf3f" />
      {/* eyes change with mood */}
      {mood === "alarm" ? (
        <>
          <path d="M46 30 l10 6 M56 30 l-10 6" stroke="#180a26" strokeWidth="3" strokeLinecap="round" />
          <path d="M74 30 l-10 6 M64 30 l10 6" stroke="#180a26" strokeWidth="3" strokeLinecap="round" />
        </>
      ) : (
        <>
          <ellipse cx="51" cy="33" rx="5" ry={mood === "neutral" ? 5 : 6.5} fill="#fff3e2" />
          <ellipse cx="69" cy="33" rx="5" ry={mood === "neutral" ? 5 : 6.5} fill="#fff3e2" />
          <circle cx="51" cy="33" r="2.2" fill="#180a26" />
          <circle cx="69" cy="33" r="2.2" fill="#180a26" />
        </>
      )}
      {/* mouth: open wide on big moments */}
      {mood === "neutral" ? (
        <path d="M53 48 C57 51 63 51 67 48" fill="none" stroke="#180a26" strokeWidth="3" strokeLinecap="round" />
      ) : (
        <ellipse cx="60" cy="50" rx="7" ry={mood === "alarm" ? 4 : 6} fill="#180a26" />
      )}
      {/* whistle on a cord */}
      <path d="M60 62 L60 74" stroke="#ffcf3f" strokeWidth="2" />
      <rect x="55" y="72" width="10" height="7" rx="3" fill="#ffcf3f" stroke="#180a26" strokeWidth="2" />
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
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4 }}>
      <motion.div
        animate={
          mood === "celebrate"
            ? { y: [0, -14, 0], rotate: [0, -4, 4, 0] }
            : mood === "hype"
              ? { y: [0, -8, 0] }
              : mood === "alarm"
                ? { x: [0, -4, 4, -4, 0] }
                : { y: [0, -3, 0] }
        }
        transition={{
          duration: mood === "neutral" ? 2.6 : 0.5,
          repeat: Infinity,
          repeatDelay: mood === "neutral" ? 0 : 0.4,
        }}
        style={{ flexShrink: 0 }}
      >
        <RefereeFigure mood={mood} />
      </motion.div>
      <AnimatePresence mode="wait">
        <motion.div
          key={line}
          initial={{ opacity: 0, scale: 0.8, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 400, damping: 24 }}
          style={{
            position: "relative",
            background: "var(--cream)",
            color: "var(--night)",
            borderRadius: 16,
            borderBottomLeftRadius: 4,
            padding: "10px 14px",
            fontWeight: 700,
            fontSize: 14,
            lineHeight: 1.3,
            marginBottom: 24,
            boxShadow: "0 4px 0 rgba(0,0,0,0.35)",
          }}
        >
          {line}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
