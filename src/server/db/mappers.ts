// Converts database rows (snake_case) into the app types (camelCase) and back.
// Keeping this in one place means the rest of the code only deals with the app
// types.

import type { TeamSide } from "../../lib/match";
import type {
  Answer,
  DepositState,
  Fixture,
  Member,
  PayoutMode,
  Question,
  QuestionOutcome,
  Room,
  RoomStatus,
  Swipe,
  WagerType,
} from "../../lib/types";

export interface FixtureRow {
  id: string;
  competition: string;
  home_team: string;
  away_team: string;
  kickoff_at: string;
}

export interface RoomRow {
  id: string;
  code: string;
  creator_id: string;
  fixture_id: string;
  team_a: TeamSide;
  wager_type: WagerType;
  stake_usd: number;
  payout_mode: PayoutMode;
  forfeit_text: string | null;
  status: RoomStatus;
  pool_address: string | null;
  created_at: string;
  lock_at: string;
}

export interface MemberRow {
  id: string;
  room_id: string;
  user_id: string;
  display_name: string;
  mascot_id: string;
  wallet_address: string | null;
  is_creator: boolean;
  deposit_state: DepositState;
  joined_at: string;
}

export interface QuestionRow {
  id: string;
  room_id: string;
  slot: number;
  template_id: string;
  team: TeamSide | null;
  text: string;
  points: number;
  outcome: QuestionOutcome;
  resolved_at: string | null;
}

export interface AnswerRow {
  id: string;
  room_id: string;
  member_id: string;
  question_id: string;
  choice: Swipe;
  locked_at: string;
}

export function toFixture(row: FixtureRow): Fixture {
  return {
    id: row.id,
    competition: row.competition,
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    kickoffAt: row.kickoff_at,
  };
}

export function toRoom(row: RoomRow, fixture: FixtureRow): Room {
  return {
    id: row.id,
    code: row.code,
    creatorId: row.creator_id,
    fixture: toFixture(fixture),
    teamA: row.team_a,
    wagerType: row.wager_type,
    stakeUsd: row.stake_usd,
    payoutMode: row.payout_mode,
    forfeitText: row.forfeit_text,
    status: row.status,
    poolAddress: row.pool_address,
    createdAt: row.created_at,
    lockAt: row.lock_at,
  };
}

export function toMember(row: MemberRow): Member {
  return {
    id: row.id,
    roomId: row.room_id,
    userId: row.user_id,
    displayName: row.display_name,
    mascotId: row.mascot_id,
    walletAddress: row.wallet_address,
    isCreator: row.is_creator,
    depositState: row.deposit_state,
    joinedAt: row.joined_at,
  };
}

export function toQuestion(row: QuestionRow): Question {
  return {
    id: row.id,
    roomId: row.room_id,
    slot: row.slot,
    templateId: row.template_id,
    team: row.team,
    text: row.text,
    points: row.points,
    outcome: row.outcome,
    resolvedAt: row.resolved_at,
  };
}

export function toAnswer(row: AnswerRow): Answer {
  return {
    id: row.id,
    roomId: row.room_id,
    memberId: row.member_id,
    questionId: row.question_id,
    choice: row.choice,
    lockedAt: row.locked_at,
  };
}
