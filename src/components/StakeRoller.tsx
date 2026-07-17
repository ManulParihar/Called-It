"use client";

// The odds board stake picker. Values roll sideways and snap; the chosen one
// sits big and lit under the pointer, like a price on the bookie's board.

import { useEffect, useRef } from "react";
import { useSoundCues } from "@/hooks/useSoundCues";

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
  const { cue } = useSoundCues();

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
      if (stake !== value) {
        cue("tick"); // the mechanical click as the board snaps to a price
        onChange(stake);
      }
    }, 80);
  }

  function jumpTo(stake: number) {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: STAKES.indexOf(stake) * ITEM_WIDTH, behavior: "smooth" });
    if (stake !== value) cue("tick");
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
          borderLeft: "8px solid transparent",
          borderRight: "8px solid transparent",
          borderTop: "9px solid var(--chalk)",
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
          background: "var(--pitch-3)",
          borderRadius: "var(--radius)",
          border: "1px solid var(--chalk-line)",
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
                fontFamily: "var(--font-mono)",
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
                fontSize: on ? 32 : 20,
                color: on
                  ? stake === 0
                    ? "var(--chalk)"
                    : "var(--amber)"
                  : "var(--chalk-dim)",
                opacity: on ? 1 : 0.45,
                transform: on ? "scale(1)" : "scale(0.85)",
                transition:
                  "transform 180ms cubic-bezier(0.23,1,0.32,1), color 180ms ease, opacity 180ms ease, font-size 180ms ease",
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
