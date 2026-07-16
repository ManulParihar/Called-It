// Builds the five questions for a room.
//
// Slots one to four come from the bank and are worth one point each. Slot five
// is always the "team A to win" question worth three points. A helper picks a
// sensible default set so a room can always be built even if the smart picker
// is unavailable.

import type { TeamSide } from "../match";
import {
  HEADLINE_TEMPLATE,
  QUESTION_BANK,
  TEMPLATES_BY_ID,
  type TeamNames,
} from "./bank";

export interface SelectedQuestion {
  slot: number;
  templateId: string;
  team: TeamSide | null;
  text: string;
  points: number;
}

// A pick of a bank template plus, for targeted templates, which team it is about.
export interface QuestionChoice {
  templateId: string;
  team?: TeamSide | null;
}

function render(
  choice: QuestionChoice,
  teams: TeamNames,
  slot: number,
): SelectedQuestion {
  const template = TEMPLATES_BY_ID[choice.templateId];
  if (!template) {
    throw new Error(`Unknown question template: ${choice.templateId}`);
  }
  const team = template.targeted ? choice.team ?? "home" : null;
  return {
    slot,
    templateId: template.id,
    team,
    text: template.render(teams, team),
    points: template.points,
  };
}

// The fixed three point question, always slot five.
export function buildHeadline(teams: TeamNames, teamA: TeamSide): SelectedQuestion {
  return render({ templateId: HEADLINE_TEMPLATE.id, team: teamA }, teams, 5);
}

// Turns four bank picks plus the headline into the full set of five questions.
// Falls back to a default pick for any slot that is missing or invalid.
export function buildQuestions(
  teams: TeamNames,
  teamA: TeamSide,
  picks: QuestionChoice[],
): SelectedQuestion[] {
  const cleaned = cleanPicks(picks, teamA);
  const questions = cleaned.map((choice, index) => render(choice, teams, index + 1));
  questions.push(buildHeadline(teams, teamA));
  return questions;
}

// A safe default set: a mix of targeted and match wide questions that works for
// any fixture. Used when the smart picker is off or returns nothing usable.
export function defaultPicks(teamA: TeamSide): QuestionChoice[] {
  return [
    { templateId: "team_scores_first", team: teamA },
    { templateId: "over_2_5_goals" },
    { templateId: "both_teams_score" },
    { templateId: "red_card_shown" },
  ];
}

// Keeps only valid, non duplicate bank picks, drops the headline template if it
// sneaks in, and tops up from the defaults to reach exactly four.
export function cleanPicks(
  picks: QuestionChoice[],
  teamA: TeamSide,
): QuestionChoice[] {
  const bankIds = new Set(QUESTION_BANK.map((t) => t.id));
  const result: QuestionChoice[] = [];
  const seen = new Set<string>();

  const consider = (choice: QuestionChoice) => {
    if (result.length >= 4) return;
    if (!bankIds.has(choice.templateId)) return;
    if (seen.has(choice.templateId)) return;
    seen.add(choice.templateId);
    result.push(choice);
  };

  picks.forEach(consider);
  defaultPicks(teamA).forEach(consider);

  return result.slice(0, 4);
}
