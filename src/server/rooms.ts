// Room actions used by the API routes: create a room, read a room, join a room,
// and submit answers. Keeping the logic here means the routes stay short and the
// same functions can be reused elsewhere.

import { randomInt } from "node:crypto";
import { z } from "zod";
import type { TeamSide } from "../lib/match";
import { generateQuestions } from "../lib/questions/engine";
import type {
  Answer,
  Fixture,
  Member,
  Question,
  Room,
  RoomBundle,
} from "../lib/types";
import { serverDb } from "./db/supabase";
import {
  toFixture,
  toMember,
  toQuestion,
  toRoom,
  type AnswerRow,
  type FixtureRow,
  type MemberRow,
  type QuestionRow,
  type RoomRow,
} from "./db/mappers";

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no easily confused letters

function makeCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

export const createRoomSchema = z.object({
  userId: z.string().min(1),
  displayName: z.string().min(1).max(40),
  mascotId: z.string().min(1),
  fixtureId: z.string().min(1),
  teamA: z.enum(["home", "away"]),
  wagerType: z.enum(["money", "forfeit"]),
  stakeUsd: z.number().int().min(0).max(100).multipleOf(10).default(0),
  payoutMode: z.enum(["winner_takes_all", "top_three", "all_but_loser"]),
  forfeitText: z.string().max(200).nullish(),
  walletAddress: z.string().nullish(),
});
export type CreateRoomInput = z.infer<typeof createRoomSchema>;

export const joinRoomSchema = z.object({
  userId: z.string().min(1),
  displayName: z.string().min(1).max(40),
  mascotId: z.string().min(1),
  walletAddress: z.string().nullish(),
});
export type JoinRoomInput = z.infer<typeof joinRoomSchema>;

export const submitAnswersSchema = z.object({
  memberId: z.string().min(1),
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        choice: z.enum(["yes", "no"]),
      }),
    )
    .min(1),
});
export type SubmitAnswersInput = z.infer<typeof submitAnswersSchema>;

async function fetchFixture(fixtureId: string): Promise<Fixture> {
  const db = serverDb();
  const { data, error } = await db
    .from("fixtures")
    .select("*")
    .eq("id", fixtureId)
    .single();
  if (error || !data) throw new Error("Fixture not found");
  return toFixture(data as FixtureRow);
}

async function uniqueCode(): Promise<string> {
  const db = serverDb();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeCode();
    const { data } = await db.from("rooms").select("id").eq("code", code).maybeSingle();
    if (!data) return code;
  }
  throw new Error("Could not generate a free room code");
}

export async function createRoom(input: CreateRoomInput): Promise<RoomBundle> {
  const db = serverDb();
  const fixture = await fetchFixture(input.fixtureId);
  const code = await uniqueCode();

  const { data: roomRow, error: roomError } = await db
    .from("rooms")
    .insert({
      code,
      creator_id: input.userId,
      fixture_id: fixture.id,
      team_a: input.teamA,
      wager_type: input.wagerType,
      stake_usd: input.wagerType === "money" ? input.stakeUsd : 0,
      payout_mode: input.payoutMode,
      forfeit_text: input.wagerType === "forfeit" ? input.forfeitText ?? null : null,
      status: "open",
      lock_at: fixture.kickoffAt,
    })
    .select("*")
    .single();
  if (roomError || !roomRow) throw new Error("Could not create the room");

  await addMember(roomRow.id, input, true);
  await createQuestions(roomRow.id, fixture, input.teamA);

  const bundle = await getRoomBundle(code);
  if (!bundle) throw new Error("Room disappeared right after creating it");
  return bundle;
}

async function addMember(
  roomId: string,
  input: { userId: string; displayName: string; mascotId: string; walletAddress?: string | null },
  isCreator: boolean,
): Promise<MemberRow> {
  const db = serverDb();
  const { data, error } = await db
    .from("members")
    .upsert(
      {
        room_id: roomId,
        user_id: input.userId,
        display_name: input.displayName,
        mascot_id: input.mascotId,
        wallet_address: input.walletAddress ?? null,
        is_creator: isCreator,
      },
      { onConflict: "room_id,user_id" },
    )
    .select("*")
    .single();
  if (error || !data) throw new Error("Could not add the player to the room");
  return data as MemberRow;
}

async function createQuestions(
  roomId: string,
  fixture: Fixture,
  teamA: TeamSide,
): Promise<void> {
  const db = serverDb();
  const selected = await generateQuestions({
    teams: { home: fixture.homeTeam, away: fixture.awayTeam },
    teamA,
    competition: fixture.competition,
  });

  const rows = selected.map((q) => ({
    room_id: roomId,
    slot: q.slot,
    template_id: q.templateId,
    team: q.team,
    text: q.text,
    points: q.points,
  }));
  const { error } = await db.from("questions").insert(rows);
  if (error) throw new Error("Could not create the questions");
}

// Reads everything about a room by its join code.
export async function getRoomBundle(code: string): Promise<RoomBundle | null> {
  const db = serverDb();
  const { data: roomRow } = await db
    .from("rooms")
    .select("*, fixtures(*)")
    .eq("code", code)
    .maybeSingle();
  if (!roomRow) return null;

  const row = roomRow as RoomRow & { fixtures: FixtureRow };
  const room = toRoom(row, row.fixtures);

  const [{ data: memberRows }, { data: questionRows }, { data: answerRows }] =
    await Promise.all([
      db.from("members").select("*").eq("room_id", room.id).order("joined_at"),
      db.from("questions").select("*").eq("room_id", room.id).order("slot"),
      db.from("answers").select("*").eq("room_id", room.id),
    ]);

  return {
    room,
    members: ((memberRows as MemberRow[]) ?? []).map(toMember),
    questions: ((questionRows as QuestionRow[]) ?? []).map(toQuestion),
    answers: ((answerRows as AnswerRow[]) ?? []).map(toAnswerRow),
  };
}

function toAnswerRow(row: AnswerRow): Answer {
  return {
    id: row.id,
    roomId: row.room_id,
    memberId: row.member_id,
    questionId: row.question_id,
    choice: row.choice,
    lockedAt: row.locked_at,
  };
}

export async function joinRoom(
  code: string,
  input: JoinRoomInput,
): Promise<RoomBundle> {
  const bundle = await getRoomBundle(code);
  if (!bundle) throw new Error("Room not found");
  if (bundle.room.status !== "open") {
    throw new Error("This room is no longer open to join");
  }
  await addMember(bundle.room.id, input, false);
  const updated = await getRoomBundle(code);
  if (!updated) throw new Error("Room not found");
  return updated;
}

export async function submitAnswers(
  code: string,
  input: SubmitAnswersInput,
): Promise<void> {
  const db = serverDb();
  const bundle = await getRoomBundle(code);
  if (!bundle) throw new Error("Room not found");
  if (bundle.room.status !== "open") {
    throw new Error("Answers are locked for this room");
  }
  if (Date.now() >= new Date(bundle.room.lockAt).getTime()) {
    throw new Error("The match has started, answers are locked");
  }

  const member = bundle.members.find((m) => m.id === input.memberId);
  if (!member) throw new Error("You are not a member of this room");

  const validQuestionIds = new Set(bundle.questions.map((q) => q.id));
  const rows = input.answers
    .filter((a) => validQuestionIds.has(a.questionId))
    .map((a) => ({
      room_id: bundle.room.id,
      member_id: input.memberId,
      question_id: a.questionId,
      choice: a.choice,
    }));

  if (rows.length === 0) throw new Error("No valid answers to save");

  const { error } = await db
    .from("answers")
    .upsert(rows, { onConflict: "member_id,question_id" });
  if (error) {
    // Log the underlying database error so the server terminal shows the real
    // cause. A common one is the answers table missing its unique
    // (member_id, question_id) constraint, which the upsert relies on.
    console.error("submitAnswers upsert failed:", error);
    throw new Error("Could not save your answers");
  }
}
