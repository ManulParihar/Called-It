"use client";

// Counts down to a moment in time, ticking once a second.

import { useEffect, useState } from "react";

function parts(msLeft: number): string {
  if (msLeft <= 0) return "00:00";
  const total = Math.floor(msLeft / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function Countdown({ to }: { to: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const msLeft = new Date(to).getTime() - now;

  return (
    <span
      className="display"
      style={{
        fontSize: 34,
        color: msLeft < 60_000 ? "var(--danger)" : "var(--gold)",
        textShadow: "0 0 16px rgba(255,207,63,0.4)",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {parts(msLeft)}
    </span>
  );
}
