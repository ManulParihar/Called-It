"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { MatchNotification } from "@/hooks/useMatchNotifications";

const MAX_VISIBLE = 3;
const AUTO_DISMISS_MS = 4000;

const TONE_TILE: Record<MatchNotification["tone"], React.CSSProperties> = {
  goal: {
    background: "rgba(255, 181, 32, 0.16)",
    border: "1px solid rgba(255, 181, 32, 0.35)",
  },
  alert: {
    background: "rgba(240, 89, 74, 0.16)",
    border: "1px solid rgba(240, 89, 74, 0.35)",
  },
  info: {
    background: "rgba(169, 183, 171, 0.14)",
    border: "1px solid rgba(169, 183, 171, 0.28)",
  },
};

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

function NotificationCard({
  item,
  reducedMotion,
  onDismiss,
}: {
  item: MatchNotification;
  reducedMotion: boolean;
  onDismiss: (id: string) => void;
}) {
  // Keep the latest onDismiss without resetting the timer if the callback
  // identity changes between renders.
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      dismissRef.current(item.id);
    }, AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [item.id]);

  return (
    <motion.div
      layout={false}
      initial={reducedMotion ? { opacity: 0 } : { y: -24, opacity: 0 }}
      animate={
        reducedMotion
          ? { opacity: 1, transition: { duration: 0.22 } }
          : { y: 0, opacity: 1, transition: { duration: 0.22, ease: "easeOut" } }
      }
      exit={
        reducedMotion
          ? { opacity: 0, transition: { duration: 0.18 } }
          : { y: -16, opacity: 0, transition: { duration: 0.18, ease: "easeIn" } }
      }
      onClick={() => onDismiss(item.id)}
      role="status"
      style={{
        pointerEvents: "auto",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: "var(--pitch-2)",
        border: "1px solid var(--chalk-line)",
        borderRadius: 14,
        padding: "10px 12px",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.45), 0 2px 6px rgba(0, 0, 0, 0.3)",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {/* Emoji tile, tinted by tone */}
      <div
        aria-hidden
        style={{
          flexShrink: 0,
          width: 36,
          height: 36,
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          lineHeight: 1,
          ...TONE_TILE[item.tone],
        }}
      >
        {item.emoji}
      </div>

      {/* Title + body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 14,
            letterSpacing: "0.02em",
            color: "var(--chalk)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {item.title}
        </div>
        <div
          style={{
            marginTop: 2,
            fontSize: 12,
            lineHeight: 1.35,
            color: "var(--chalk-dim)",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {item.body}
        </div>
      </div>

      {/* App label + timestamp, sells the lock-screen look */}
      <div
        style={{
          flexShrink: 0,
          alignSelf: "flex-start",
          display: "flex",
          alignItems: "center",
          gap: 5,
          paddingTop: 1,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.08em",
            color: "var(--chalk-dim)",
          }}
        >
          CALLED IT
        </span>
        <span
          aria-hidden
          style={{
            width: 3,
            height: 3,
            borderRadius: "50%",
            background: "var(--chalk-dim)",
            opacity: 0.6,
          }}
        />
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--chalk-dim)",
          }}
        >
          now
        </span>
      </div>
    </motion.div>
  );
}

export function NotificationHost({
  items,
  onDismiss,
}: {
  items: MatchNotification[];
  onDismiss: (id: string) => void;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const visible = items.slice(0, MAX_VISIBLE);

  return (
    <div
      aria-live="polite"
      style={{
        position: "fixed",
        top: "calc(8px + env(safe-area-inset-top))",
        left: 8,
        right: 8,
        zIndex: 70,
        pointerEvents: "none",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        maxWidth: 460,
        margin: "0 auto",
      }}
    >
      <AnimatePresence initial={false}>
        {visible.map((item) => (
          <NotificationCard
            key={item.id}
            item={item}
            reducedMotion={reducedMotion}
            onDismiss={onDismiss}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
