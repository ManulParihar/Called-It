// The shape of a football match as we track it during play.
//
// The TxLINE feed reports team level events only. There is no player data, so
// everything here is about a team or the match as a whole. The raw feed uses
// numeric ids for the match phase and numeric prefixes for stat periods. We map
// those to readable names here so the rest of the app never deals with the raw
// numbers.

export type TeamSide = "home" | "away";

// Phase ids as sent by the feed, mapped to names we can read.
export const MATCH_PHASE_BY_ID: Record<number, MatchPhase> = {
  1: "not_started",
  2: "first_half",
  3: "half_time",
  4: "second_half",
  5: "ended",
  6: "extra_time_first_half",
  7: "extra_time_break",
  8: "extra_time_second_half",
  9: "extra_time_end",
  10: "awaiting_penalties",
  11: "penalties",
  12: "penalties_break",
  13: "penalties_end",
  14: "interrupted",
  15: "abandoned",
  16: "cancelled",
  17: "coverage_cancelled",
  18: "coverage_suspended",
  19: "postponed",
};

export type MatchPhase =
  | "not_started"
  | "first_half"
  | "half_time"
  | "second_half"
  | "ended"
  | "extra_time_first_half"
  | "extra_time_break"
  | "extra_time_second_half"
  | "extra_time_end"
  | "awaiting_penalties"
  | "penalties"
  | "penalties_break"
  | "penalties_end"
  | "interrupted"
  | "abandoned"
  | "cancelled"
  | "coverage_cancelled"
  | "coverage_suspended"
  | "postponed";

// Phases where the match result is final.
export const FINISHED_PHASES: MatchPhase[] = ["ended", "penalties_end"];

// Phases where the match will not produce a result and stakes should refund.
export const VOID_PHASES: MatchPhase[] = [
  "abandoned",
  "cancelled",
  "coverage_cancelled",
  "postponed",
];

// Stat period prefixes used by the feed.
export const PERIOD_BY_PREFIX: Record<number, MatchPeriod> = {
  0: "total",
  1000: "first_half",
  2000: "half_time",
  3000: "second_half",
  4000: "extra_time_first_half",
  5000: "extra_time_second_half",
  6000: "penalties",
  7000: "extra_time_total",
};

export type MatchPeriod =
  | "total"
  | "first_half"
  | "half_time"
  | "second_half"
  | "extra_time_first_half"
  | "extra_time_second_half"
  | "penalties"
  | "extra_time_total";

// A single thing that happened in the match, after we normalize the feed.
export type MatchEventKind =
  | "phase_change"
  | "goal"
  | "yellow_card"
  | "red_card"
  | "corner"
  | "penalty_awarded"
  | "var_review"
  | "substitution";

export interface MatchEvent {
  fixtureId: string;
  kind: MatchEventKind;
  // Which team the event belongs to, when it applies to one team.
  team?: TeamSide;
  // Match minute when the event happened, when the feed provides it.
  minute?: number;
  // The phase the match moved into, for phase_change events.
  phase?: MatchPhase;
  // Feed sequence number, used to drop out of order or repeated messages.
  seq?: number;
  // When we received the event.
  receivedAt: string;
}

// A per team count that we build up as events come in.
export interface TeamCounts {
  home: number;
  away: number;
}

// The running state of a match. We fold events into this and read from it to
// resolve questions.
export interface MatchState {
  fixtureId: string;
  phase: MatchPhase;
  minute: number;

  goals: TeamCounts;
  goalsFirstHalf: TeamCounts;
  goalsSecondHalf: TeamCounts;

  // Score captured at the moment the match reached half time.
  halfTimeScore: TeamCounts | null;

  yellowCards: TeamCounts;
  redCards: TeamCounts;
  corners: TeamCounts;

  // The team that scored the first goal, if any.
  firstGoalTeam: TeamSide | null;
  // The team shown the first card of any colour, if any.
  firstCardTeam: TeamSide | null;

  // True once a goal is scored inside the first fifteen minutes.
  goalInFirstFifteen: boolean;
  // True once a goal is scored after the ninetieth minute.
  goalAfterNinety: boolean;

  penaltyAwarded: boolean;
  varReviewOccurred: boolean;

  updatedAt: string;
}

export function emptyCounts(): TeamCounts {
  return { home: 0, away: 0 };
}

export function initialMatchState(fixtureId: string): MatchState {
  return {
    fixtureId,
    phase: "not_started",
    minute: 0,
    goals: emptyCounts(),
    goalsFirstHalf: emptyCounts(),
    goalsSecondHalf: emptyCounts(),
    halfTimeScore: null,
    yellowCards: emptyCounts(),
    redCards: emptyCounts(),
    corners: emptyCounts(),
    firstGoalTeam: null,
    firstCardTeam: null,
    goalInFirstFifteen: false,
    goalAfterNinety: false,
    penaltyAwarded: false,
    varReviewOccurred: false,
    updatedAt: new Date().toISOString(),
  };
}
