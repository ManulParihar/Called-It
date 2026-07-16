"use client";

// The green room before kickoff. Share the code, watch the crew lock in
// their calls, count down to the whistle.

import { useState } from "react";
import { motion } from "framer-motion";
import type { Member, RoomBundle } from "@/lib/types";
import { hasAnswered, potCents } from "@/lib/live";
import { MascotAvatar } from "./MascotAvatar";
import { Countdown } from "./Countdown";
import { Referee } from "./Referee";

export function WaitingScreen({
  bundle,
  me,
}: {
  bundle: RoomBundle;
  me: Member;
}) {
  const [copied, setCopied] = useState(false);
  const room = bundle.room;
  const waitingOn = bundle.members.filter((m) => !hasAnswered(bundle, m.id));
  const everyoneIn = waitingOn.length === 0;
  const pot = potCents(bundle);

  async function share() {
    const url = `${window.location.origin}/join/${room.code}`;
    const text = `Call the match with us: ${room.fixture.homeTeam} vs ${room.fixture.awayTeam}. Room ${room.code}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Called It", text, url });
        return;
      }
    } catch {
      // fall through to the clipboard
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard blocked; the visible code is still there to read out
    }
  }

  const refereeLine = everyoneIn
    ? "Everyone is locked in. Nothing to do now but sweat."
    : waitingOn.some((m) => m.id === me.id)
      ? "You still owe me five calls, friend!"
      : `Still waiting on ${waitingOn.map((m) => m.displayName).join(", ")}.`;

  return (
    <main style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
      <header style={{ textAlign: "center", paddingTop: 8 }}>
        <p className="eyebrow">{room.fixture.competition}</p>
        <h1 style={{ fontSize: 22 }}>
          {room.fixture.homeTeam}{" "}
          <span style={{ color: "var(--tangerine)" }}>vs</span>{" "}
          {room.fixture.awayTeam}
        </h1>
      </header>

      <section className="card poster-stripes" style={{ textAlign: "center" }}>
        <p className="eyebrow">Calls lock in</p>
        <Countdown to={room.lockAt} />
        {room.wagerType === "money" ? (
          <p style={{ fontWeight: 700, marginTop: 6 }}>
            <span style={{ color: "var(--lime)" }}>
              ${(pot / 100).toFixed(0)} pot
            </span>{" "}
            <span className="muted">· ${room.stakeUsd} a head</span>
          </p>
        ) : (
          <p style={{ fontWeight: 700, marginTop: 6, color: "var(--tangerine)" }}>
            Loser: {room.forfeitText}
          </p>
        )}
      </section>

      <section
        className="card"
        style={{ display: "flex", alignItems: "center", gap: 12 }}
      >
        <div style={{ flex: 1 }}>
          <p className="eyebrow">Room code</p>
          <p className="room-code" style={{ fontSize: 26, textAlign: "left" }}>
            {room.code}
          </p>
        </div>
        <button className="btn btn-small" onClick={share}>
          {copied ? "Copied!" : "Invite"}
        </button>
      </section>

      <section>
        <p className="eyebrow" style={{ marginBottom: 8 }}>
          The crew ({bundle.members.length})
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {bundle.members.map((m, i) => {
            const done = hasAnswered(bundle, m.id);
            return (
              <motion.div
                key={m.id}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.05 * i, type: "spring", stiffness: 300, damping: 18 }}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 3,
                  width: 66,
                  position: "relative",
                }}
              >
                <div
                  className={done ? "" : "floaty"}
                  style={{ opacity: done ? 1 : 0.55 }}
                >
                  <MascotAvatar mascotId={m.mascotId} size={54} />
                </div>
                {done && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="display"
                    style={{
                      position: "absolute",
                      top: -4,
                      right: 2,
                      background: "var(--lime)",
                      color: "var(--night)",
                      borderRadius: "50%",
                      width: 20,
                      height: 20,
                      fontSize: 13,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    ✓
                  </motion.span>
                )}
                <span
                  className="muted"
                  style={{
                    fontSize: 10,
                    maxWidth: 66,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {m.displayName}
                  {m.id === me.id ? " (you)" : ""}
                </span>
              </motion.div>
            );
          })}
        </div>
      </section>

      <div style={{ marginTop: "auto" }}>
        <Referee mood={everyoneIn ? "hype" : "neutral"} line={refereeLine} />
      </div>
    </main>
  );
}
