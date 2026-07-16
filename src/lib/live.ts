// Read helpers the screens use to show live state, built on top of the shared
// game logic so the numbers always match what the server settles.

import { buildLeaderboard } from "./scoring/score";
import { computePayouts } from "./scoring/payout";
import type {
  LeaderboardEntry,
  Member,
  PayoutShare,
  RoomBundle,
} from "./types";

// The leaderboard as it stands right now. Only resolved questions count, so the
// order moves as the match plays out.
export function liveLeaderboard(bundle: RoomBundle): LeaderboardEntry[] {
  return buildLeaderboard(bundle.members, bundle.questions, bundle.answers);
}

// The total pot for a money room, in whole cents.
export function potCents(bundle: RoomBundle): number {
  if (bundle.room.wagerType !== "money") return 0;
  return bundle.room.stakeUsd * bundle.members.length * 100;
}

// What each player would receive if the room settled right now.
export function projectedPayouts(bundle: RoomBundle): PayoutShare[] {
  if (bundle.room.wagerType !== "money") return [];
  const board = liveLeaderboard(bundle);
  return computePayouts(bundle.room.payoutMode, board, potCents(bundle));
}

// True once a player has locked in an answer for every question.
export function hasAnswered(bundle: RoomBundle, memberId: string): boolean {
  const answered = new Set(
    bundle.answers.filter((a) => a.memberId === memberId).map((a) => a.questionId),
  );
  return bundle.questions.every((q) => answered.has(q.id));
}

// Players who still need to lock in their answers.
export function membersStillToAnswer(bundle: RoomBundle): Member[] {
  return bundle.members.filter((m) => !hasAnswered(bundle, m.id));
}
