// Shared game types used across the server, the API, and the screens.
//
// These describe a room, the players in it, the five questions, the answers,
// and the results. The UI reads and writes these shapes, so keep them stable.

import type { TeamSide } from "./match";

// How the group is playing for stakes.
export type WagerType = "money" | "forfeit";

// How a money pot is split at the end.
export type PayoutMode =
  | "winner_takes_all" // top scorer takes the whole pot, ties split it
  | "top_three" // top three split 50 / 30 / 20
  | "all_but_loser"; // everyone except the single lowest scorer shares by points

// Where a room is in its life.
export type RoomStatus =
  | "open" // players can still join and answer
  | "locked" // answers are in, waiting for or watching the match
  | "live" // match is in play
  | "settled" // scored and paid out or forfeit assigned
  | "cancelled"; // match voided, stakes refunded

// A player swipes right for yes or left for no.
export type Swipe = "yes" | "no";

// How a question turned out once the match resolves it.
export type QuestionOutcome = "pending" | "yes" | "no" | "void";

// The two teams in the fixture.
export interface Fixture {
  id: string;
  competition: string;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: string;
}

export interface Room {
  id: string;
  code: string; // short code used in the join link
  creatorId: string;
  fixture: Fixture;
  // Which side is "team A" for the three point question. The creator picks this.
  teamA: TeamSide;
  wagerType: WagerType;
  // Stake per person in whole dollars, 0 to 100 in steps of 10. Money mode only.
  stakeUsd: number;
  payoutMode: PayoutMode;
  // The forfeit text for the loser. Forfeit mode only.
  forfeitText: string | null;
  status: RoomStatus;
  // Address of the on chain pool, set once the pot is created. Money mode only.
  poolAddress: string | null;
  createdAt: string;
  // Answers lock at kickoff.
  lockAt: string;
}

// Whether a player has put their stake into the pot.
export type DepositState = "none" | "pending" | "deposited" | "refunded" | "paid";

export interface Member {
  id: string;
  roomId: string;
  userId: string;
  displayName: string;
  mascotId: string;
  walletAddress: string | null;
  isCreator: boolean;
  depositState: DepositState;
  joinedAt: string;
}

// A question shown to every player in the room. The four one point questions
// come from the bank; the fifth is always the team A win question worth three
// points. `templateId` and `team` say how to resolve it from the match state.
export interface Question {
  id: string;
  roomId: string;
  slot: number; // 1 to 5, 5 is the three point question
  templateId: string;
  // The team the question is about, when it targets one team.
  team: TeamSide | null;
  text: string; // rendered prompt, for example "Brazil to win?"
  points: number; // 1 for slots 1 to 4, 3 for slot 5
  outcome: QuestionOutcome;
  resolvedAt: string | null;
}

export interface Answer {
  id: string;
  roomId: string;
  memberId: string;
  questionId: string;
  choice: Swipe;
  lockedAt: string;
}

// One row of the final standings.
export interface LeaderboardEntry {
  memberId: string;
  displayName: string;
  mascotId: string;
  points: number;
  rank: number; // 1 is best, ties share a rank
  isWinner: boolean;
  isLoser: boolean;
}

// What a single player receives when a money pot settles.
export interface PayoutShare {
  memberId: string;
  // Payout in whole cents, so the shares always sum to the pot with no rounding
  // drift.
  amountCents: number;
}

// Everything the screens need about one room, returned by the room endpoints.
export interface RoomBundle {
  room: Room;
  members: Member[];
  questions: Question[];
  answers: Answer[];
}

// The full result of a room, ready to show and to settle.
export interface RoomResult {
  roomId: string;
  leaderboard: LeaderboardEntry[];
  // Set for money rooms. Empty for forfeit rooms.
  payouts: PayoutShare[];
  // Set for forfeit rooms: the members who owe the forfeit.
  forfeitMemberIds: string[];
  voided: boolean;
}
