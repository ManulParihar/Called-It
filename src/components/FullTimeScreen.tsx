"use client";

// Full time. The final score, the winners on the podium, the money split or
// the forfeit read out loud by the referee.

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
      colors: ["#c8f527", "#ff2e88", "#ffcf3f", "#3fd8e8"],
    });
    // Once, when the screen appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const forfeitRoom = room.wagerType === "forfeit";
  const refereeLine = forfeitRoom
    ? losers.length > 0
      ? `Hear ye! ${losers.map((l) => l.displayName).join(" and ")} must now: ${room.forfeitText}!`
      : "All square! Nobody owes a thing. Boring, but fair."
    : winners.length > 0
      ? `${winners.map((w) => w.displayName).join(" and ")} called it! Pay the champions!`
      : "No winners tonight. The pot goes back.";

  return (
    <main style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
      <header style={{ textAlign: "center", paddingTop: 10 }}>
        <p className="eyebrow">Full time</p>
        <h1 style={{ fontSize: 26 }}>
          {room.fixture.homeTeam}{" "}
          <span style={{ color: "var(--gold)" }}>
            {matchState?.goals.home ?? 0}:{matchState?.goals.away ?? 0}
          </span>{" "}
          {room.fixture.awayTeam}
        </h1>
        <motion.p
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 260, damping: 16 }}
          className="display"
          style={{
            marginTop: 8,
            fontSize: 22,
            color: meWon ? "var(--lime)" : meLost ? "var(--danger)" : "var(--cream)",
          }}
        >
          {meWon ? "You called it!" : meLost ? "Rough night, champ." : "Middle of the pack."}
        </motion.p>
      </header>

      {/* winners podium */}
      {winners.length > 0 && (
        <section
          style={{ display: "flex", justifyContent: "center", gap: 18, padding: "4px 0" }}
        >
          {winners.map((w, i) => (
            <motion.div
              key={w.memberId}
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 + i * 0.1, type: "spring", stiffness: 220, damping: 16 }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
            >
              <motion.span
                animate={{ rotate: [0, -8, 8, 0] }}
                transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 0.6 }}
                className="display"
                style={{ fontSize: 22, color: "var(--gold)" }}
              >
                ♛
              </motion.span>
              <div className="floaty">
                <MascotAvatar mascotId={w.mascotId} size={76} />
              </div>
              <span className="display" style={{ fontSize: 13, color: "var(--gold)" }}>
                {w.displayName}
              </span>
            </motion.div>
          ))}
        </section>
      )}

      <Referee mood={forfeitRoom && losers.length > 0 ? "hype" : "celebrate"} line={refereeLine} />

      {/* the forfeit, big and unmissable */}
      {forfeitRoom && losers.length > 0 && (
        <motion.section
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.5, type: "spring", stiffness: 200, damping: 14 }}
          className="card"
          style={{
            textAlign: "center",
            borderColor: "var(--danger)",
            boxShadow: "0 0 30px rgba(255,66,66,0.35)",
          }}
        >
          <p className="eyebrow" style={{ color: "var(--danger)" }}>
            The forfeit
          </p>
          <p className="display" style={{ fontSize: 20, margin: "8px 0", color: "var(--cream)" }}>
            {room.forfeitText}
          </p>
          <p className="muted">
            Owed by {losers.map((l) => l.displayName).join(" and ")}
          </p>
        </motion.section>
      )}

      {/* money summary */}
      {!forfeitRoom && (
        <section className="card" style={{ textAlign: "center" }}>
          <p className="eyebrow">The pot</p>
          <p className="display" style={{ fontSize: 30, color: "var(--lime)" }}>
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
