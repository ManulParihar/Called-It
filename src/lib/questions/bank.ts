// The pool of questions we can ask about a match.
//
// Every question is about a team or the match as a whole, because the data feed
// does not report individual players. Every question can be answered from the
// running MatchState, so scoring never depends on the odds feed. Odds are only
// used when choosing and phrasing questions, not when resolving them.
//
// Each template knows how to write its own prompt and how to decide its outcome.
// An outcome is "pending" until we can be sure, then "yes" or "no". Some
// questions can settle early (for example, once a red card is shown the answer
// is yes and cannot change). Others can only settle at full time.

import {
  isFinished,
  matchWinner,
  type MatchState,
  type TeamSide,
} from "../match";
import type { QuestionOutcome } from "../types";

export type QuestionCategory =
  | "result"
  | "goals"
  | "cards"
  | "set_pieces";

export interface TeamNames {
  home: string;
  away: string;
}

export interface QuestionTemplate {
  id: string;
  category: QuestionCategory;
  points: number;
  // True when the question is about one specific team.
  targeted: boolean;
  // True when the question reads better with a favourite or underdog, so the
  // selector prefers it when odds are available. It still resolves from scores.
  likesOdds?: boolean;
  render(teams: TeamNames, team: TeamSide | null): string;
  evaluate(state: MatchState, team: TeamSide | null): QuestionOutcome;
}

function name(teams: TeamNames, side: TeamSide): string {
  return side === "home" ? teams.home : teams.away;
}

function other(side: TeamSide): TeamSide {
  return side === "home" ? "away" : "home";
}

function sideCount(counts: { home: number; away: number }, side: TeamSide): number {
  return side === "home" ? counts.home : counts.away;
}

// Yes as soon as the condition is true, otherwise no once the match is over.
function yesWhenTrue(condition: boolean, state: MatchState): QuestionOutcome {
  if (condition) return "yes";
  return isFinished(state) ? "no" : "pending";
}

// No as soon as the blocker is true, otherwise yes once the match is over.
function noWhenBlocked(blocked: boolean, state: MatchState): QuestionOutcome {
  if (blocked) return "no";
  return isFinished(state) ? "yes" : "pending";
}

export const QUESTION_BANK: QuestionTemplate[] = [
  // --- Result ---
  {
    id: "team_win",
    category: "result",
    points: 1,
    targeted: true,
    likesOdds: true,
    render: (t, side) => `${name(t, side!)} to win?`,
    evaluate: (s, side) => {
      const winner = matchWinner(s);
      if (winner) return winner === side ? "yes" : "no";
      return isFinished(s) ? "no" : "pending";
    },
  },
  {
    id: "match_drawn",
    category: "result",
    points: 1,
    targeted: false,
    render: () => "Match to end level?",
    evaluate: (s) => {
      if (!isFinished(s)) return "pending";
      return matchWinner(s) === null ? "yes" : "no";
    },
  },

  // --- Goals ---
  {
    id: "over_2_5_goals",
    category: "goals",
    points: 1,
    targeted: false,
    render: () => "More than two goals in the match?",
    evaluate: (s) => yesWhenTrue(s.goals.home + s.goals.away >= 3, s),
  },
  {
    id: "under_1_5_goals",
    category: "goals",
    points: 1,
    targeted: false,
    render: () => "Fewer than two goals in the match?",
    evaluate: (s) => noWhenBlocked(s.goals.home + s.goals.away >= 2, s),
  },
  {
    id: "both_teams_score",
    category: "goals",
    points: 1,
    targeted: false,
    render: () => "Both teams to score?",
    evaluate: (s) => yesWhenTrue(s.goals.home > 0 && s.goals.away > 0, s),
  },
  {
    id: "team_scores_twice",
    category: "goals",
    points: 1,
    targeted: true,
    render: (t, side) => `${name(t, side!)} to score two or more?`,
    evaluate: (s, side) => yesWhenTrue(sideCount(s.goals, side!) >= 2, s),
  },
  {
    id: "team_kept_scoreless",
    category: "goals",
    points: 1,
    targeted: true,
    render: (t, side) => `${name(t, side!)} to be kept scoreless?`,
    evaluate: (s, side) => noWhenBlocked(sideCount(s.goals, side!) > 0, s),
  },
  {
    id: "team_scores_first",
    category: "goals",
    points: 1,
    targeted: true,
    likesOdds: true,
    render: (t, side) => `${name(t, side!)} to score first?`,
    evaluate: (s, side) => {
      if (s.firstGoalTeam !== null) return s.firstGoalTeam === side ? "yes" : "no";
      return isFinished(s) ? "no" : "pending";
    },
  },
  {
    id: "team_scores_in_first_half",
    category: "goals",
    points: 1,
    targeted: true,
    render: (t, side) => `${name(t, side!)} to score in the first half?`,
    evaluate: (s, side) => {
      if (sideCount(s.goalsFirstHalf, side!) > 0) return "yes";
      // The first half is done once the match reaches half time or beyond.
      const firstHalfOver = s.phase !== "not_started" && s.phase !== "first_half";
      return firstHalfOver ? "no" : "pending";
    },
  },
  {
    id: "goal_in_first_fifteen",
    category: "goals",
    points: 1,
    targeted: false,
    render: () => "A goal inside the first fifteen minutes?",
    evaluate: (s) => {
      if (s.goalInFirstFifteen) return "yes";
      if (s.minute > 15 || isFinished(s)) return "no";
      return "pending";
    },
  },
  {
    id: "team_leads_at_half_time",
    category: "goals",
    points: 1,
    targeted: true,
    render: (t, side) => `${name(t, side!)} to lead at half time?`,
    evaluate: (s, side) => {
      if (s.halfTimeScore === null) return isFinished(s) ? "no" : "pending";
      const mine = sideCount(s.halfTimeScore, side!);
      const theirs = sideCount(s.halfTimeScore, other(side!));
      return mine > theirs ? "yes" : "no";
    },
  },
  {
    id: "level_at_half_time",
    category: "goals",
    points: 1,
    targeted: false,
    render: () => "Level at half time?",
    evaluate: (s) => {
      if (s.halfTimeScore === null) return isFinished(s) ? "no" : "pending";
      return s.halfTimeScore.home === s.halfTimeScore.away ? "yes" : "no";
    },
  },
  {
    id: "more_goals_in_second_half",
    category: "goals",
    points: 1,
    targeted: false,
    render: () => "More goals in the second half than the first?",
    evaluate: (s) => {
      const first = s.goalsFirstHalf.home + s.goalsFirstHalf.away;
      const second = s.goalsSecondHalf.home + s.goalsSecondHalf.away;
      return yesWhenTrue(second > first, s);
    },
  },
  {
    id: "goal_after_ninety",
    category: "goals",
    points: 1,
    targeted: false,
    render: () => "A goal after the ninetieth minute?",
    evaluate: (s) => yesWhenTrue(s.goalAfterNinety, s),
  },

  // --- Cards ---
  {
    id: "team_first_card",
    category: "cards",
    points: 1,
    targeted: true,
    render: (t, side) => `${name(t, side!)} to get the first card?`,
    evaluate: (s, side) => {
      if (s.firstCardTeam !== null) return s.firstCardTeam === side ? "yes" : "no";
      return isFinished(s) ? "no" : "pending";
    },
  },
  {
    id: "red_card_shown",
    category: "cards",
    points: 1,
    targeted: false,
    render: () => "A red card in the match?",
    evaluate: (s) => yesWhenTrue(s.redCards.home + s.redCards.away > 0, s),
  },
  {
    id: "four_yellow_cards",
    category: "cards",
    points: 1,
    targeted: false,
    render: () => "Four or more yellow cards?",
    evaluate: (s) => yesWhenTrue(s.yellowCards.home + s.yellowCards.away >= 4, s),
  },
  {
    id: "team_two_yellows",
    category: "cards",
    points: 1,
    targeted: true,
    render: (t, side) => `${name(t, side!)} to get two or more yellows?`,
    evaluate: (s, side) => yesWhenTrue(sideCount(s.yellowCards, side!) >= 2, s),
  },

  // --- Set pieces ---
  {
    id: "penalty_awarded",
    category: "set_pieces",
    points: 1,
    targeted: false,
    render: () => "A penalty to be awarded?",
    evaluate: (s) => yesWhenTrue(s.penaltyAwarded, s),
  },
  {
    id: "over_9_5_corners",
    category: "set_pieces",
    points: 1,
    targeted: false,
    render: () => "Ten or more corners in the match?",
    evaluate: (s) => yesWhenTrue(s.corners.home + s.corners.away >= 10, s),
  },
  {
    id: "team_more_corners",
    category: "set_pieces",
    points: 1,
    targeted: true,
    render: (t, side) => `${name(t, side!)} to win more corners?`,
    evaluate: (s, side) => {
      if (!isFinished(s)) return "pending";
      return sideCount(s.corners, side!) > sideCount(s.corners, other(side!))
        ? "yes"
        : "no";
    },
  },
  {
    id: "var_review",
    category: "set_pieces",
    points: 1,
    targeted: false,
    render: () => "A VAR review during the match?",
    evaluate: (s) => yesWhenTrue(s.varReviewOccurred, s),
  },
];

// The fixed three point question that is always the fifth card in a room.
export const HEADLINE_TEMPLATE: QuestionTemplate = {
  id: "headline_team_win",
  category: "result",
  points: 3,
  targeted: true,
  render: (t, side) => `${name(t, side!)} to win the match?`,
  evaluate: (s, side) => {
    const winner = matchWinner(s);
    if (winner) return winner === side ? "yes" : "no";
    return isFinished(s) ? "no" : "pending";
  },
};

export const TEMPLATES_BY_ID: Record<string, QuestionTemplate> = Object.fromEntries(
  [...QUESTION_BANK, HEADLINE_TEMPLATE].map((tpl) => [tpl.id, tpl]),
);
