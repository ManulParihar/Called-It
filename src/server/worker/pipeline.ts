// The heart of the worker: takes one match event and updates everything that
// depends on it.
//
// For each event we:
//   1. Save the event so the live ticker can show it.
//   2. Fold it into the running match state and save that.
//   3. Resolve any questions that the new state settles.
//   4. Move rooms along: to live while the match plays, to settled at full time,
//      or to cancelled if the match is voided.
//
// The match state is passed in and returned so the caller can keep it in memory
// between events and avoid reloading it every time.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  initialMatchState,
  isFinished,
  isVoid,
  type MatchEvent,
  type MatchState,
} from "../../lib/match";
import { applyEvent } from "../../lib/match-reducer";
import { resolveChanged } from "../../lib/questions/resolve";
import { buildLeaderboard } from "../../lib/scoring/score";
import { computePayouts } from "../../lib/scoring/payout";
import type { Member, Question, Room } from "../../lib/types";
import {
  toMember,
  toQuestion,
  toRoom,
  type FixtureRow,
  type MemberRow,
  type QuestionRow,
  type RoomRow,
} from "../db/mappers";
import { refundRoom, settleMoneyRoom } from "../settlement";

// Phases where the match is being played, so rooms should show as live.
const IN_PLAY = new Set([
  "first_half",
  "second_half",
  "extra_time_first_half",
  "extra_time_second_half",
  "awaiting_penalties",
  "penalties",
]);

export async function processEvent(
  db: SupabaseClient,
  state: MatchState,
  event: MatchEvent,
): Promise<MatchState> {
  await saveEvent(db, event);

  const nextState = applyEvent(state, event);
  await saveState(db, nextState);

  await updateRooms(db, nextState);

  return nextState;
}

// Loads the last known state for a fixture, or a fresh one if there is none.
export async function loadState(
  db: SupabaseClient,
  fixtureId: string,
): Promise<MatchState> {
  const { data } = await db
    .from("match_state")
    .select("state")
    .eq("fixture_id", fixtureId)
    .maybeSingle();
  const stored = (data?.state as MatchState | undefined) ?? null;
  return stored ?? initialMatchState(fixtureId);
}

async function saveEvent(db: SupabaseClient, event: MatchEvent): Promise<void> {
  await db.from("match_events").insert({
    fixture_id: event.fixtureId,
    kind: event.kind,
    team: event.team ?? null,
    minute: event.minute ?? null,
    phase: event.phase ?? null,
    seq: event.seq ?? null,
    received_at: event.receivedAt,
  });
}

async function saveState(db: SupabaseClient, state: MatchState): Promise<void> {
  await db.from("match_state").upsert(
    { fixture_id: state.fixtureId, state, updated_at: state.updatedAt },
    { onConflict: "fixture_id" },
  );
}

// Resolves questions and advances room status for every active room on the
// fixture.
async function updateRooms(db: SupabaseClient, state: MatchState): Promise<void> {
  const { data: roomRows } = await db
    .from("rooms")
    .select("*, fixtures(*)")
    .eq("fixture_id", state.fixtureId)
    .in("status", ["open", "locked", "live"]);

  if (!roomRows) return;

  for (const row of roomRows as (RoomRow & { fixtures: FixtureRow })[]) {
    const room = toRoom(row, row.fixtures);
    await resolveRoomQuestions(db, room, state);
    await advanceRoom(db, room, state);
  }
}

async function resolveRoomQuestions(
  db: SupabaseClient,
  room: Room,
  state: MatchState,
): Promise<void> {
  const { data: questionRows } = await db
    .from("questions")
    .select("*")
    .eq("room_id", room.id);
  if (!questionRows) return;

  const questions = (questionRows as QuestionRow[]).map(toQuestion);
  const changed = resolveChanged(questions, state);

  for (const q of changed) {
    await db
      .from("questions")
      .update({ outcome: q.outcome, resolved_at: q.resolvedAt })
      .eq("id", q.id);
  }
}

async function advanceRoom(
  db: SupabaseClient,
  room: Room,
  state: MatchState,
): Promise<void> {
  if (isVoid(state)) {
    await cancelRoom(db, room);
    return;
  }
  if (isFinished(state)) {
    await settleRoom(db, room);
    return;
  }
  if (IN_PLAY.has(state.phase) && room.status !== "live") {
    await db.from("rooms").update({ status: "live" }).eq("id", room.id);
  }
}

async function loadMembersAndAnswers(db: SupabaseClient, room: Room) {
  const [{ data: memberRows }, { data: questionRows }, { data: answerRows }] =
    await Promise.all([
      db.from("members").select("*").eq("room_id", room.id),
      db.from("questions").select("*").eq("room_id", room.id),
      db.from("answers").select("*").eq("room_id", room.id),
    ]);

  const members: Member[] = ((memberRows as MemberRow[]) ?? []).map(toMember);
  const questions: Question[] = ((questionRows as QuestionRow[]) ?? []).map(toQuestion);
  const answers = ((answerRows as { member_id: string; question_id: string; choice: "yes" | "no" }[]) ?? []).map(
    (r) => ({
      id: "",
      roomId: room.id,
      memberId: r.member_id,
      questionId: r.question_id,
      choice: r.choice,
      lockedAt: "",
    }),
  );

  return { members, questions, answers };
}

async function settleRoom(db: SupabaseClient, room: Room): Promise<void> {
  const { members, questions, answers } = await loadMembersAndAnswers(db, room);
  const leaderboard = buildLeaderboard(members, questions, answers);

  if (room.wagerType === "money") {
    const potCents = room.stakeUsd * members.length * 100;
    const payouts = computePayouts(room.payoutMode, leaderboard, potCents);
    const result = await settleMoneyRoom(room, members, payouts);
    // Only mark members who actually received a transfer. A member can be
    // owed money and still miss out here if they had no wallet on file or
    // the settlement transaction failed outright; deposit_state should
    // reflect that instead of assuming every entitled member got paid.
    const paidIds = new Set(result.paidMemberIds);
    for (const member of members) {
      if (paidIds.has(member.id)) {
        await db.from("members").update({ deposit_state: "paid" }).eq("id", member.id);
      }
    }
  }

  await db.from("rooms").update({ status: "settled" }).eq("id", room.id);
}

async function cancelRoom(db: SupabaseClient, room: Room): Promise<void> {
  const { members } = await loadMembersAndAnswers(db, room);
  if (room.wagerType === "money") {
    const result = await refundRoom(room, members).catch(
      () => ({ ok: false, signatures: [], paidMemberIds: [] }) as const,
    );
    const refundedIds = new Set(result.paidMemberIds);
    for (const member of members) {
      if (!refundedIds.has(member.id)) continue;
      await db.from("members").update({ deposit_state: "refunded" }).eq("id", member.id);
    }
  }
  await db.from("rooms").update({ status: "cancelled" }).eq("id", room.id);
}
