"use client";

// The live match screen. Score up top, the referee calling the action, big
// flashes for the loud moments, the event ticker, and the running order.

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Member, RoomBundle } from "@/lib/types";
import type { MatchState, TeamSide } from "@/lib/match";
import { liveLeaderboard, projectedPayouts } from "@/lib/live";
import type { LiveEvent } from "@/hooks/useRoomBundle";
import { useSoundCues, type SoundCue } from "@/hooks/useSoundCues";
import { EventFlash, type FlashSpec } from "./EventFlash";
import { Leaderboard } from "./Leaderboard";
import { Referee, type RefereeMood } from "./Referee";

const PHASE_LABELS: Record<string, string> = {
  not_started: "Waiting for kickoff",
  first_half: "First half",
  half_time: "Half time",
  second_half: "Second half",
  ended: "Full time",
  extra_time_first_half: "Extra time",
  extra_time_break: "Extra time break",
  extra_time_second_half: "Extra time",
  extra_time_end: "End of extra time",
  awaiting_penalties: "Penalties coming",
  penalties: "Penalty shootout",
  penalties_break: "Shootout break",
  penalties_end: "Shootout over",
  interrupted: "Interrupted",
};

const LOUD: Record<string, SoundCue> = {
  goal: "goal",
  red_card: "red_card",
  penalty_awarded: "penalty",
  var_review: "var",
};

interface RefereeState {
  mood: RefereeMood;
  line: string;
}

function refereeFor(event: LiveEvent, teamName: string | null): RefereeState | null {
  switch (event.kind) {
    case "goal":
      return { mood: "celebrate", line: `GOAL for ${teamName}! The arena erupts!` };
    case "red_card":
      return { mood: "alarm", line: `RED CARD! ${teamName} are down a fighter!` };
    case "penalty_awarded":
      return { mood: "alarm", line: `Penalty to ${teamName}! Huge moment!` };
    case "var_review":
      return { mood: "alarm", line: "VAR is having a look. Nobody breathe." };
    case "yellow_card":
      return { mood: "hype", line: `${teamName} go into the book.` };
    case "corner":
      return { mood: "neutral", line: `Corner for ${teamName}. Bodies in the box!` };
    case "substitution":
      return { mood: "neutral", line: `Fresh legs coming on for ${teamName}.` };
    case "phase_change":
      switch (event.phase) {
        case "first_half":
          return { mood: "hype", line: "We are LIVE! Your calls are locked!" };
        case "half_time":
          return { mood: "neutral", line: "Half time. Check the standings and sweat." };
        case "second_half":
          return { mood: "hype", line: "Back underway! Everything to play for!" };
        case "ended":
          return { mood: "celebrate", line: "Full time! Counting up the damage…" };
        default:
          return null;
      }
    default:
      return null;
  }
}

function eventLabel(event: LiveEvent, teamName: string | null): string {
  const min = event.minute != null ? `${event.minute}'` : "";
  switch (event.kind) {
    case "goal":
      return `${min} Goal, ${teamName}`;
    case "yellow_card":
      return `${min} Yellow card, ${teamName}`;
    case "red_card":
      return `${min} Red card, ${teamName}`;
    case "corner":
      return `${min} Corner, ${teamName}`;
    case "penalty_awarded":
      return `${min} Penalty, ${teamName}`;
    case "var_review":
      return `${min} VAR review`;
    case "substitution":
      return `${min} Substitution, ${teamName}`;
    case "phase_change":
      return PHASE_LABELS[event.phase ?? ""] ?? "Phase change";
    default:
      return event.kind;
  }
}

export function LiveScreen({
  bundle,
  matchState,
  events,
  me,
}: {
  bundle: RoomBundle;
  matchState: MatchState | null;
  events: LiveEvent[];
  me: Member;
}) {
  const room = bundle.room;
  const { cue } = useSoundCues();

  const teamName = (side: TeamSide | null): string | null =>
    side === "home" ? room.fixture.homeTeam : side === "away" ? room.fixture.awayTeam : null;

  // Feed new events into the flash queue and the referee, one pass per event.
  const processed = useRef(0);
  const [flashQueue, setFlashQueue] = useState<FlashSpec[]>([]);
  const [referee, setReferee] = useState<RefereeState>({
    mood: "neutral",
    line: "I have eyes on the pitch. Stay close.",
  });

  useEffect(() => {
    if (events.length <= processed.current) return;
    const fresh = events.slice(processed.current);
    processed.current = events.length;

    const newFlashes: FlashSpec[] = [];
    for (const event of fresh) {
      const name = teamName(event.team);
      const nextReferee = refereeFor(event, name);
      if (nextReferee) setReferee(nextReferee);
      if (LOUD[event.kind]) {
        cue(LOUD[event.kind]);
        newFlashes.push({ key: event.id, kind: event.kind, teamName: name });
      }
    }
    if (newFlashes.length > 0) setFlashQueue((q) => [...q, ...newFlashes]);
    // teamName is stable per room; events drive this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  const board = useMemo(() => liveLeaderboard(bundle), [bundle]);
  const payouts = useMemo(() => {
    if (room.wagerType !== "money") return undefined;
    return new Map(projectedPayouts(bundle).map((p) => [p.memberId, p.amountCents]));
  }, [bundle, room.wagerType]);

  const phase = matchState?.phase ?? "not_started";
  const inPlay = phase !== "not_started";
  const myAnswers = new Map(
    bundle.answers.filter((a) => a.memberId === me.id).map((a) => [a.questionId, a.choice]),
  );
  const questions = [...bundle.questions].sort((a, b) => a.slot - b.slot);
  const ticker = [...events].reverse().slice(0, 12);

  return (
    <main style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
      <EventFlash
        flash={flashQueue[0] ?? null}
        onDone={() => setFlashQueue((q) => q.slice(1))}
      />

      {/* scoreboard */}
      <section
        className="card poster-stripes"
        style={{ textAlign: "center", padding: "18px 12px" }}
      >
        <p className="eyebrow" style={{ display: "flex", justifyContent: "center", gap: 8, alignItems: "center" }}>
          {inPlay && phase !== "ended" && <span className="live-dot" />}
          {PHASE_LABELS[phase] ?? phase}
          {matchState && inPlay && phase !== "ended" ? ` · ${matchState.minute}'` : ""}
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            marginTop: 10,
          }}
        >
          <p className="display" style={{ fontSize: 15, flex: 1, textAlign: "left" }}>
            {room.fixture.homeTeam}
          </p>
          <motion.p
            key={`${matchState?.goals.home ?? 0}-${matchState?.goals.away ?? 0}`}
            initial={{ scale: 1.6, color: "#c8f527" }}
            animate={{ scale: 1, color: "#fff3e2" }}
            transition={{ duration: 0.5 }}
            className="display"
            style={{ fontSize: 42, whiteSpace: "nowrap" }}
          >
            {matchState?.goals.home ?? 0}
            <span style={{ color: "var(--cream-dim)", fontSize: 28 }}> : </span>
            {matchState?.goals.away ?? 0}
          </motion.p>
          <p className="display" style={{ fontSize: 15, flex: 1, textAlign: "right" }}>
            {room.fixture.awayTeam}
          </p>
        </div>
      </section>

      <Referee mood={referee.mood} line={referee.line} />

      {/* your five calls, colouring in as the match resolves them */}
      <section>
        <p className="eyebrow" style={{ marginBottom: 6 }}>
          Your calls
        </p>
        <div style={{ display: "flex", gap: 6 }}>
          {questions.map((q) => {
            const mine = myAnswers.get(q.id);
            const hit = q.outcome !== "pending" && q.outcome !== "void" && mine === q.outcome;
            const miss = q.outcome !== "pending" && q.outcome !== "void" && mine !== q.outcome;
            return (
              <motion.div
                key={q.id}
                layout
                animate={
                  hit
                    ? { borderColor: "rgba(200,245,39,0.8)", background: "rgba(200,245,39,0.12)" }
                    : miss
                      ? { borderColor: "rgba(255,66,66,0.8)", background: "rgba(255,66,66,0.1)" }
                      : {}
                }
                className="card"
                style={{
                  flex: 1,
                  padding: "8px 4px",
                  textAlign: "center",
                  borderColor: q.points === 3 ? "var(--gold)" : undefined,
                }}
                title={q.text}
              >
                <p className="display" style={{ fontSize: 12, color: "var(--cream-dim)" }}>
                  {q.points === 3 ? "★" : `Q${q.slot}`}
                </p>
                <p
                  className="display"
                  style={{
                    fontSize: 13,
                    color:
                      mine === "yes" ? "var(--lime)" : mine ? "var(--danger)" : "var(--cream-dim)",
                  }}
                >
                  {mine ?? "-"}
                </p>
                <p style={{ fontSize: 11, fontWeight: 800 }}>
                  {hit ? (
                    <span style={{ color: "var(--lime)" }}>+{q.points}</span>
                  ) : miss ? (
                    <span style={{ color: "var(--danger)" }}>0</span>
                  ) : (
                    <span className="muted">…</span>
                  )}
                </p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* running order */}
      <section>
        <p className="eyebrow" style={{ marginBottom: 6 }}>
          The order as it stands
        </p>
        <Leaderboard entries={board} payoutByMember={payouts} highlightMemberId={me.id} />
      </section>

      {/* ticker */}
      <section style={{ paddingBottom: 8 }}>
        <p className="eyebrow" style={{ marginBottom: 6 }}>
          What happened
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <AnimatePresence initial={false}>
            {ticker.length === 0 && (
              <p className="muted" style={{ fontSize: 13 }}>
                Nothing yet. The whistle is coming.
              </p>
            )}
            {ticker.map((event) => (
              <motion.p
                key={event.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color:
                    event.kind === "goal"
                      ? "var(--lime)"
                      : event.kind === "red_card"
                        ? "var(--danger)"
                        : event.kind === "penalty_awarded"
                          ? "var(--tangerine)"
                          : "var(--cream-dim)",
                }}
              >
                {eventLabel(event, teamName(event.team))}
              </motion.p>
            ))}
          </AnimatePresence>
        </div>
      </section>
    </main>
  );
}
