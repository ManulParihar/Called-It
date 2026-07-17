"use client";

// The live match screen. Scoreboard up top, the bookie calling the action,
// headline slams for the loud moments, your slip being stamped line by line,
// the standings, and the wire at the bottom.

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Member, RoomBundle } from "@/lib/types";
import type { MatchState, TeamSide } from "@/lib/match";
import { liveLeaderboard, potCents, projectedPayouts } from "@/lib/live";
import type { LiveEvent } from "@/hooks/useRoomBundle";
import type { MatchNotification } from "@/hooks/useMatchNotifications";
import { useSoundCues, type SoundCue } from "@/hooks/useSoundCues";
import { EventFlash, type FlashSpec } from "./EventFlash";
import { Leaderboard } from "./Leaderboard";
import { Referee, type RefereeAct, type RefereeCue, type RefereeMood } from "./Referee";

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
  yellow_card: "yellow_card",
  penalty_awarded: "penalty",
  var_review: "var",
};

interface RefereeState {
  mood: RefereeMood;
  line: string;
  act?: RefereeAct; // absent only for his resting line before anything happens
}

const RESTING: RefereeState = {
  mood: "neutral",
  line: "Book's closed. I see everything from here.",
};

function refereeFor(event: LiveEvent, teamName: string | null): RefereeState | null {
  switch (event.kind) {
    case "goal":
      return { mood: "celebrate", act: "goal", line: `GOAL, ${teamName}! The whole board just moved!` };
    case "red_card":
      return { mood: "alarm", act: "red_card", line: `Red card! ${teamName} down to ten. Slips are shaking.` };
    case "penalty_awarded":
      return { mood: "alarm", act: "penalty", line: `Penalty to ${teamName}. Somebody's slip hangs on this.` };
    case "var_review":
      return { mood: "alarm", act: "var", line: "VAR check. Nobody touch their slip." };
    case "yellow_card":
      return { mood: "hype", act: "yellow_card", line: `${teamName} go in the book. So noted.` };
    case "corner":
      return { mood: "neutral", act: "corner", line: `Corner, ${teamName}. Cheap drama.` };
    case "substitution":
      return { mood: "neutral", act: "substitution", line: `Change on for ${teamName}.` };
    case "phase_change":
      switch (event.phase) {
        case "first_half":
          return {
            mood: "hype",
            act: "kickoff",
            line: "Whistle's gone. The book is closed — slips are locked!",
          };
        case "half_time":
          return { mood: "neutral", act: "half_time", line: "Half time. Check your lines and breathe." };
        case "second_half":
          return { mood: "hype", act: "kickoff", line: "Back on. Everything still to pay for!" };
        case "ended":
          return { mood: "celebrate", act: "full_time", line: "Full time! Bring me your slips…" };
        default:
          return null;
      }
    default:
      return null;
  }
}

// Which moments earn the whole screen. Corners and substitutions deliberately
// get nothing: a full screen slam for a corner is how this turns into noise by
// the twentieth minute. The bookie still calls those.
const FLASH_KINDS = new Set(["goal", "red_card", "penalty_awarded", "var_review", "yellow_card"]);

function flashFor(event: LiveEvent, teamName: string | null): FlashSpec | null {
  if (event.kind === "phase_change") {
    // Full time is a phase change, not a kind of its own.
    return event.phase === "ended" ? { key: event.id, kind: "full_time", teamName: null } : null;
  }
  if (!FLASH_KINDS.has(event.kind)) return null;
  return { key: event.id, kind: event.kind, teamName };
}

// The loud moments also raise an in-app notification banner (see
// NotificationHost). Same hierarchy as the flashes minus the yellow: goals and
// the two that can swing a slip. Full time is raised by the room page instead,
// because this screen unmounts the instant the room settles.
function notificationFor(
  event: LiveEvent,
  teamName: string | null,
  fixture: { homeTeam: string; awayTeam: string },
  matchState: MatchState | null,
): MatchNotification | null {
  const gh = matchState?.goals.home ?? 0;
  const ga = matchState?.goals.away ?? 0;
  const score = `${fixture.homeTeam} ${gh}–${ga} ${fixture.awayTeam}`;
  const id = String(event.id);
  switch (event.kind) {
    case "goal":
      return { id, emoji: "⚽", tone: "goal", title: `GOAL — ${teamName}`, body: `${score} · your slip just moved` };
    case "red_card":
      return { id, emoji: "🟥", tone: "alert", title: `RED CARD — ${teamName}`, body: "Down to ten. Slips are shaking." };
    case "penalty_awarded":
      return { id, emoji: "🎯", tone: "alert", title: `PENALTY — ${teamName}`, body: "Someone's slip hangs on this." };
    default:
      return null;
  }
}

function eventLabel(event: LiveEvent, teamName: string | null): string {
  const min = event.minute != null ? `${event.minute}'` : "";
  switch (event.kind) {
    case "goal":
      return `${min} GOAL — ${teamName}`;
    case "yellow_card":
      return `${min} Yellow card, ${teamName}`;
    case "red_card":
      return `${min} RED CARD — ${teamName}`;
    case "corner":
      return `${min} Corner, ${teamName}`;
    case "penalty_awarded":
      return `${min} PENALTY — ${teamName}`;
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
  onNotify,
}: {
  bundle: RoomBundle;
  matchState: MatchState | null;
  events: LiveEvent[];
  me: Member;
  onNotify?: (n: MatchNotification) => void;
}) {
  const room = bundle.room;
  const { cue } = useSoundCues();

  // Read the latest score inside the events effect without making it a
  // dependency (the effect is driven by events alone; the bundle updates them
  // together, so the ref holds the post-goal score by the time it runs).
  const matchStateRef = useRef(matchState);
  matchStateRef.current = matchState;

  const teamName = (side: TeamSide | null): string | null =>
    side === "home" ? room.fixture.homeTeam : side === "away" ? room.fixture.awayTeam : null;

  // Feed new events into the flash queue and the bookie, one pass per event.
  //
  // Anything already in the list when this screen mounts is history, not news:
  // the room backfills every event that has happened so far, so a member who
  // reloads at half time would otherwise get a flash for every goal at once.
  // Starting the cursor at the end means only what arrives afterwards performs.
  const processed = useRef(events.length);
  const [flashQueue, setFlashQueue] = useState<FlashSpec[]>([]);
  const [refereeCue, setRefereeCue] = useState<RefereeCue | null>(null);

  // He still catches up on the mood: the last thing that happened is where he
  // already is, he just does not re-perform it.
  const [referee, setReferee] = useState<RefereeState>(() => {
    for (let i = events.length - 1; i >= 0; i--) {
      const caught = refereeFor(events[i], teamName(events[i].team));
      if (caught) return caught;
    }
    return RESTING;
  });

  useEffect(() => {
    if (events.length <= processed.current) return;
    const fresh = events.slice(processed.current);
    processed.current = events.length;

    const newFlashes: FlashSpec[] = [];
    for (const event of fresh) {
      const name = teamName(event.team);
      const nextReferee = refereeFor(event, name);
      if (nextReferee) {
        setReferee(nextReferee);
        if (nextReferee.act) setRefereeCue({ act: nextReferee.act, key: event.id });
      }
      if (LOUD[event.kind]) cue(LOUD[event.kind]);
      // The referee's whistle for kickoff and the restart. (Full time is
      // handled on the full-time screen, which this one gives way to.)
      if (event.kind === "phase_change" && (event.phase === "first_half" || event.phase === "second_half")) {
        cue("whistle");
      }
      if (onNotify) {
        const banner = notificationFor(event, name, room.fixture, matchStateRef.current);
        if (banner) onNotify(banner);
      }
      const flash = flashFor(event, name);
      if (flash) newFlashes.push(flash);
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
  const pot = potCents(bundle);

  return (
    <main style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
      <EventFlash
        flash={flashQueue[0] ?? null}
        onDone={() => setFlashQueue((q) => q.slice(1))}
      />

      {/* scoreboard */}
      <section className="card" style={{ textAlign: "center", padding: "16px 12px" }}>
        <p
          className="eyebrow"
          style={{ display: "flex", justifyContent: "center", gap: 8, alignItems: "center" }}
        >
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
            initial={{ scale: 1.5 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", duration: 0.45, bounce: 0.3 }}
            className="display tnum"
            style={{ fontSize: 44, whiteSpace: "nowrap", color: "var(--amber)" }}
          >
            {matchState?.goals.home ?? 0}
            <span style={{ color: "var(--chalk-dim)", fontSize: 26 }}> – </span>
            {matchState?.goals.away ?? 0}
          </motion.p>
          <p className="display" style={{ fontSize: 15, flex: 1, textAlign: "right" }}>
            {room.fixture.awayTeam}
          </p>
        </div>
        {/* what's riding on it, always in view */}
        <p
          style={{
            marginTop: 8,
            fontFamily: "var(--font-mono)",
            fontWeight: 700,
            fontSize: 12,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: room.wagerType === "money" ? "var(--amber)" : "var(--stamp-bright)",
          }}
        >
          {room.wagerType === "money"
            ? `Pot $${(pot / 100).toFixed(0)} · winner paid at full time`
            : `At stake: ${room.forfeitText}`}
        </p>
      </section>

      <Referee mood={referee.mood} line={referee.line} act={refereeCue} />

      {/* your slip, stamped line by line as the match resolves it */}
      <section>
        <p className="eyebrow" style={{ marginBottom: 6 }}>
          Your slip
        </p>
        <div className="slip" style={{ padding: "8px 12px", fontSize: 12 }}>
          {questions.map((q, i) => {
            const mine = myAnswers.get(q.id);
            const hit = q.outcome !== "pending" && q.outcome !== "void" && mine === q.outcome;
            const miss = q.outcome !== "pending" && q.outcome !== "void" && mine !== q.outcome;
            return (
              <div
                key={q.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "5px 0",
                  borderBottom:
                    i < questions.length - 1 ? "1px dashed rgba(23,21,15,0.18)" : "none",
                }}
              >
                <span
                  style={{
                    fontWeight: 700,
                    color: q.points === 3 ? "var(--ink)" : "var(--ink-soft)",
                    background: q.points === 3 ? "rgba(255,181,32,0.5)" : "none",
                    padding: q.points === 3 ? "0 4px" : 0,
                    fontSize: 11,
                  }}
                >
                  {q.points === 3 ? "3PT" : `Q${q.slot}`}
                </span>
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontWeight: 700,
                  }}
                  title={q.text}
                >
                  {q.text}
                </span>
                <span
                  style={{
                    fontWeight: 700,
                    textTransform: "uppercase",
                    color: mine === "yes" ? "var(--grass-ink)" : mine ? "var(--stamp)" : "var(--ink-soft)",
                  }}
                >
                  {mine ?? "—"}
                </span>
                <span style={{ width: 34, textAlign: "right", fontWeight: 700 }}>
                  {hit ? (
                    <motion.span
                      initial={{ scale: 1.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", duration: 0.35, bounce: 0.4 }}
                      style={{ display: "inline-block", color: "var(--grass-ink)" }}
                    >
                      ✓ +{q.points}
                    </motion.span>
                  ) : miss ? (
                    <motion.span
                      initial={{ scale: 1.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", duration: 0.35, bounce: 0.4 }}
                      style={{ display: "inline-block", color: "var(--stamp)" }}
                    >
                      ✗ 0
                    </motion.span>
                  ) : (
                    <span style={{ color: "var(--ink-soft)" }}>…</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
        <div className="slip-tear" />
      </section>

      {/* running order */}
      <section>
        <p className="eyebrow" style={{ marginBottom: 6 }}>
          The order as it stands
        </p>
        <Leaderboard entries={board} payoutByMember={payouts} highlightMemberId={me.id} />
      </section>

      {/* the wire */}
      <section style={{ paddingBottom: 8 }}>
        <p className="eyebrow" style={{ marginBottom: 6 }}>
          The wire
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
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  fontWeight: 700,
                  color:
                    event.kind === "goal"
                      ? "var(--grass)"
                      : event.kind === "red_card"
                        ? "var(--stamp-bright)"
                        : event.kind === "penalty_awarded"
                          ? "var(--amber)"
                          : "var(--chalk-dim)",
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
