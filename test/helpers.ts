// Small builders so the tests can make objects without repeating every field.

import type { Answer, Member, Question, QuestionOutcome, Swipe } from "../src/lib/types";

let counter = 0;
function id(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

export function member(displayName: string, joinedAt = "2026-07-16T00:00:00.000Z"): Member {
  return {
    id: id("member"),
    roomId: "room-1",
    userId: id("user"),
    displayName,
    mascotId: "fox",
    walletAddress: null,
    isCreator: false,
    depositState: "deposited",
    joinedAt,
  };
}

export function question(
  slot: number,
  points: number,
  outcome: QuestionOutcome,
): Question {
  return {
    id: `q-${slot}`,
    roomId: "room-1",
    slot,
    templateId: "over_2_5_goals",
    team: null,
    text: "test question",
    points,
    outcome,
    resolvedAt: outcome === "pending" ? null : "2026-07-16T02:00:00.000Z",
  };
}

export function answer(memberId: string, questionId: string, choice: Swipe): Answer {
  return {
    id: id("answer"),
    roomId: "room-1",
    memberId,
    questionId,
    choice,
    lockedAt: "2026-07-16T00:30:00.000Z",
  };
}
