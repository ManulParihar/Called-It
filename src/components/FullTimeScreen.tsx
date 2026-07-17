"use client";

// Full time. The final score, the winners, the money split — or the
// settlement slip with the forfeit stamped on it, read out by the bookie.

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import type { Member, RoomBundle } from "@/lib/types";
import type { MatchState } from "@/lib/match";
import { liveLeaderboard, potCents, projectedPayouts } from "@/lib/live";
import { useSoundCues } from "@/hooks/useSoundCues";
import { Leaderboard } from "./Leaderboard";
import { MascotAvatar } from "./MascotAvatar";
import { Referee } from "./Referee";

const EASE = [0.23, 1, 0.32, 1] as const;

export function FullTimeScreen({
  bundle,
  matchState,
  me,
}: {
  bundle: RoomBundle;
  matchState: MatchState | null;
  me: Member;
}) {
  const room = bundle.room;
  const { cue } = useSoundCues();
  const board = useMemo(() => liveLeaderboard(bundle), [bundle]);
  const winners = board.filter((e) => e.isWinner);
  const losers = board.filter((e) => e.isLoser);
  const meWon = winners.some((e) => e.memberId === me.id);
  const meLost = losers.some((e) => e.memberId === me.id);

  const payouts = useMemo(() => {
    if (room.wagerType !== "money") return undefined;
    return new Map(projectedPayouts(bundle).map((p) => [p.memberId, p.amountCents]));
  }, [bundle, room.wagerType]);

  // One burst of confetti as the curtain drops, a bigger one if you won.
  useEffect(() => {
    cue(meWon ? "win" : "whistle");
    confetti({
      particleCount: meWon ? 220 : 80,
      spread: 100,
      origin: { y: 0.4 },
      colors: ["#f2f4ec", "#ffb520", "#45b26b", "#f4efe2"],
    });
    // Once, when the screen appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const forfeitRoom = room.wagerType === "forfeit";
  const refereeLine = forfeitRoom
    ? losers.length > 0
      ? `Slips checked. ${losers.map((l) => l.displayName).join(" and ")} — you owe: ${room.forfeitText}. Pay up.`
      : "All square. Nobody pays. Rarest result in football."
    : winners.length > 0
      ? `${winners.map((w) => w.displayName).join(" and ")} called it. The pot's theirs.`
      : "Nobody called it. The pot goes back where it came from.";

  return (
    <main style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
      <header style={{ textAlign: "center", paddingTop: 10 }}>
        <p className="eyebrow">Full time</p>
        <h1 style={{ fontSize: 26 }}>
          {room.fixture.homeTeam}{" "}
          <span className="tnum" style={{ color: "var(--amber)" }}>
            {matchState?.goals.home ?? 0}–{matchState?.goals.away ?? 0}
          </span>{" "}
          {room.fixture.awayTeam}
        </h1>
        <motion.p
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: "spring", duration: 0.45, bounce: 0.35 }}
          className="display"
          style={{
            marginTop: 8,
            fontSize: 26,
            color: meWon
              ? "var(--grass)"
              : meLost
                ? "var(--stamp-bright)"
                : "var(--chalk)",
          }}
        >
          {meWon ? "You called it" : meLost ? "It's you. You pay." : "Safe. Not glorious."}
        </motion.p>
      </header>

      {/* winners */}
      {winners.length > 0 && (
        <section
          style={{ display: "flex", justifyContent: "center", gap: 20, padding: "4px 0" }}
        >
          {winners.map((w, i) => (
            <motion.div
              key={w.memberId}
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 + i * 0.08, type: "spring", duration: 0.5, bounce: 0.3 }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
            >
              <MascotAvatar mascotId={w.mascotId} size={72} />
              <span className="display" style={{ fontSize: 13, color: "var(--amber)" }}>
                {w.displayName}
              </span>
            </motion.div>
          ))}
        </section>
      )}

      <Referee mood={forfeitRoom && losers.length > 0 ? "hype" : "celebrate"} line={refereeLine} />

      {/* the settlement slip, stamped loud */}
      {forfeitRoom && losers.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.3, ease: EASE }}
        >
          <div
            className="slip"
            style={{ padding: "14px 16px", textAlign: "center", position: "relative" }}
          >
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.16em",
                color: "var(--ink-soft)",
              }}
            >
              SETTLEMENT SLIP
            </p>
            <hr className="slip-rule" />
            <p className="display" style={{ fontSize: 22, margin: "6px 0", color: "var(--ink)" }}>
              {room.forfeitText}
            </p>
            <p style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)" }}>
              OWED BY {losers.map((l) => l.displayName.toUpperCase()).join(" AND ")}
            </p>
            {/* the stamp comes down */}
            <motion.span
              initial={{ scale: 2, opacity: 0, rotate: 4 }}
              animate={{ scale: 1, opacity: 1, rotate: -8 }}
              transition={{ delay: 0.75, duration: 0.22, ease: EASE }}
              className="stamp"
              aria-hidden
              style={{
                position: "absolute",
                right: 10,
                top: 8,
                fontSize: 18,
                color: "var(--stamp)",
              }}
            >
              Settle up
            </motion.span>
          </div>
          <div className="slip-tear" />
        </motion.section>
      )}

      {/* money summary */}
      {!forfeitRoom && (
        <section className="card" style={{ textAlign: "center" }}>
          <p className="eyebrow">The pot</p>
          <p className="display tnum" style={{ fontSize: 34, color: "var(--amber)" }}>
            ${(potCents(bundle) / 100).toFixed(0)}
          </p>
          <p className="muted" style={{ fontSize: 12 }}>
            Split shown next to each name below.
          </p>
        </section>
      )}

      <section>
        <p className="eyebrow" style={{ marginBottom: 8 }}>
          Final standings
        </p>
        <Leaderboard entries={board} payoutByMember={payouts} highlightMemberId={me.id} final />
      </section>

      <div style={{ marginTop: "auto", paddingTop: 8 }}>
        <Link href="/lobby" className="btn" style={{ textDecoration: "none" }}>
          Run it back
        </Link>
      </div>
    </main>
  );
}
