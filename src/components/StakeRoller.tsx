"use client";

// Slot machine style stake picker. Values roll sideways and snap, the chosen
// one sits big in the middle under the pointer.

import { useEffect, useRef } from "react";

const STAKES = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
const ITEM_WIDTH = 92;

export function StakeRoller({
  value,
  onChange,
}: {
  value: number;
  onChange: (stake: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Start the roller on the current value.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const index = Math.max(0, STAKES.indexOf(value));
    track.scrollLeft = index * ITEM_WIDTH;
    // We only want this on mount; after that the user drives the scroll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleScroll() {
    const track = trackRef.current;
    if (!track) return;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const index = Math.round(track.scrollLeft / ITEM_WIDTH);
      const stake = STAKES[Math.min(STAKES.length - 1, Math.max(0, index))];
      if (stake !== value) onChange(stake);
    }, 80);
  }

  function jumpTo(stake: number) {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: STAKES.indexOf(stake) * ITEM_WIDTH, behavior: "smooth" });
    onChange(stake);
  }

  return (
    <div style={{ position: "relative" }}>
      {/* the pointer over the middle slot */}
      <div
        style={{
          position: "absolute",
          top: -6,
          left: "50%",
          transform: "translateX(-50%)",
          width: 0,
          height: 0,
          borderLeft: "9px solid transparent",
          borderRight: "9px solid transparent",
          borderTop: "10px solid var(--gold)",
          zIndex: 2,
        }}
      />
      <div
        ref={trackRef}
        onScroll={handleScroll}
        style={{
          display: "flex",
          overflowX: "auto",
          scrollSnapType: "x mandatory",
          scrollbarWidth: "none",
          padding: `14px calc(50% - ${ITEM_WIDTH / 2}px)`,
          background: "var(--night-3)",
          borderRadius: "var(--radius)",
          border: "2px solid rgba(255,243,226,0.12)",
          maskImage:
            "linear-gradient(90deg, transparent, #000 22%, #000 78%, transparent)",
          WebkitMaskImage:
            "linear-gradient(90deg, transparent, #000 22%, #000 78%, transparent)",
        }}
      >
        {STAKES.map((stake) => {
          const on = stake === value;
          return (
            <button
              key={stake}
              onClick={() => jumpTo(stake)}
              style={{
                flex: `0 0 ${ITEM_WIDTH}px`,
                scrollSnapAlign: "center",
                fontFamily: "var(--font-display)",
                fontSize: on ? 34 : 22,
                color: on
                  ? stake === 0
                    ? "var(--sky)"
                    : "var(--lime)"
                  : "var(--cream-dim)",
                opacity: on ? 1 : 0.45,
                transform: on ? "scale(1)" : "scale(0.85)",
                transition: "all 0.18s ease",
                textShadow: on ? "0 0 18px rgba(200,245,39,0.5)" : "none",
              }}
            >
              {stake === 0 ? "FREE" : `$${stake}`}
            </button>
          );
        })}
      </div>
    </div>
  );
}
