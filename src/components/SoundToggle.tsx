"use client";

import { motion } from "framer-motion";
import { useSoundCues } from "@/hooks/useSoundCues";

const TOGGLE_TRANSITION = { duration: 0.16, ease: "easeOut" as const };

export function SoundToggle() {
  const { muted, toggleMute } = useSoundCues();

  return (
    <motion.button
      type="button"
      onClick={toggleMute}
      aria-pressed={muted}
      aria-label={muted ? "Unmute sound" : "Mute sound"}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      whileTap={{ scale: 0.9 }}
      style={{
        position: "fixed",
        bottom: "calc(16px + env(safe-area-inset-bottom))",
        left: "calc(12px + env(safe-area-inset-left))",
        zIndex: 60,
        pointerEvents: "auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 40,
        height: 40,
        minWidth: 40,
        minHeight: 40,
        padding: 0,
        borderRadius: "50%",
        border: "1px solid var(--chalk-line)",
        background: "rgba(8, 17, 13, 0.92)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        boxShadow: "0 3px 0 rgba(0,0,0,0.4)",
        color: muted ? "var(--chalk-dim)" : "var(--amber)",
        cursor: "pointer",
      }}
    >
      <svg
        width={20}
        height={20}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{ display: "block" }}
      >
        {/* Speaker body */}
        <path
          d="M11 5 6.5 9H3.5a.5.5 0 0 0-.5.5v5a.5.5 0 0 0 .5.5h3L11 19V5Z"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth={1.5}
        />
        {/* Sound waves — visible when sound is on */}
        <motion.path
          d="M14.5 9.5a3.5 3.5 0 0 1 0 5"
          animate={{ opacity: muted ? 0 : 1 }}
          transition={TOGGLE_TRANSITION}
        />
        <motion.path
          d="M17 7a7 7 0 0 1 0 10"
          animate={{ opacity: muted ? 0 : 1 }}
          transition={TOGGLE_TRANSITION}
        />
        {/* Diagonal slash — drawn in when muted */}
        <motion.line
          x1={4}
          y1={4}
          x2={20}
          y2={20}
          initial={false}
          animate={{ pathLength: muted ? 1 : 0, opacity: muted ? 1 : 0 }}
          transition={TOGGLE_TRANSITION}
        />
      </svg>
    </motion.button>
  );
}
