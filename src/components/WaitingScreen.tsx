"use client";

// The turnstiles before kickoff. Share the ticket, watch the crew hand in
// their slips, count down to the whistle.

import { useState } from "react";
import { motion } from "framer-motion";
import type { Member, RoomBundle } from "@/lib/types";
import { hasAnswered, potCents } from "@/lib/live";
import { MascotAvatar } from "./MascotAvatar";
import { Countdown } from "./Countdown";
import { Referee } from "./Referee";

const EASE = [0.23, 1, 0.32, 1] as const;

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
    ? "All slips in. Nothing left now but the sweat."
    : waitingOn.some((m) => m.id === me.id)
      ? "You've not filled your slip yet, friend."
      : `Waiting on ${waitingOn.map((m) => m.displayName).join(", ")}. Chase them up.`;

  return (
    <main style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
      <header style={{ textAlign: "center", paddingTop: 8 }}>
        <p className="eyebrow">{room.fixture.competition}</p>
        <h1 style={{ fontSize: 24 }}>
          {room.fixture.homeTeam} <span style={{ color: "var(--amber)" }}>v</span>{" "}
          {room.fixture.awayTeam}
        </h1>
      </header>

      <section className="card" style={{ textAlign: "center" }}>
        <p className="eyebrow">Slips lock in</p>
        <Countdown to={room.lockAt} />
        {room.wagerType === "money" ? (
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: 700,
              fontSize: 13,
              marginTop: 6,
            }}
          >
            <span style={{ color: "var(--amber)" }}>${(pot / 100).toFixed(0)} POT</span>{" "}
            <span className="muted">· ${room.stakeUsd} a head</span>
          </p>
        ) : (
          <p
            style={{
              fontWeight: 700,
              marginTop: 6,
              color: "var(--stamp-bright)",
              fontFamily: "var(--font-mono)",
              fontSize: 13,
            }}
          >
            AT STAKE: {room.forfeitText}
          </p>
        )}
      </section>

      {/* the ticket stub for the door */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: EASE }}
      >
        <div
          className="slip"
          style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}
        >
          <div style={{ flex: 1 }}>
            <p
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.16em",
                color: "var(--ink-soft)",
              }}
            >
              ADMIT YOUR CREW · ROOM
            </p>
            <p
              className="room-code"
              style={{ fontSize: 26, textAlign: "left", color: "var(--ink)" }}
            >
              {room.code}
            </p>
          </div>
          <button className="btn btn-small" onClick={share}>
            {copied ? "Copied!" : "Invite"}
          </button>
        </div>
        <div className="slip-tear" />
      </motion.section>

      <section>
        <p className="eyebrow" style={{ marginBottom: 8 }}>
          Through the turnstiles ({bundle.members.length})
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {bundle.members.map((m, i) => {
            const done = hasAnswered(bundle, m.id);
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 * i, duration: 0.25, ease: EASE }}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 3,
                  width: 66,
                  position: "relative",
                }}
              >
                <div style={{ opacity: done ? 1 : 0.5 }}>
                  <MascotAvatar mascotId={m.mascotId} size={54} />
                </div>
                {done && (
                  <motion.span
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", duration: 0.35, bounce: 0.4 }}
                    style={{
                      position: "absolute",
                      top: -4,
                      right: 2,
                      background: "var(--grass)",
                      color: "var(--ink)",
                      borderRadius: "50%",
                      width: 20,
                      height: 20,
                      fontSize: 12,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    aria-label="slip in"
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
