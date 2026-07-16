// Picks the four bank questions for a room.
//
// It asks the language model to choose a varied, fun set of four questions that
// fit the fixture. If the model is unavailable, returns bad JSON, or picks
// anything invalid, the choices are cleaned and topped up from the defaults, so
// this function always returns a full, valid set of five questions.

import Anthropic from "@anthropic-ai/sdk";
import type { TeamSide } from "../match";
import { QUESTION_BANK, type TeamNames } from "./bank";
import {
  buildQuestions,
  defaultPicks,
  type QuestionChoice,
  type SelectedQuestion,
} from "./select";

export interface GenerateInput {
  teams: TeamNames;
  teamA: TeamSide;
  competition: string;
  // The pre match favourite, when odds are available. Used only for phrasing
  // and to bias the picks toward the favourite or underdog.
  favourite?: TeamSide | null;
}

const DEFAULT_MODEL = "claude-sonnet-5";

function catalogForPrompt(): string {
  return QUESTION_BANK.map((t) => {
    const target = t.targeted ? " (needs a team: home or away)" : "";
    return `- ${t.id} [${t.category}]${target}`;
  }).join("\n");
}

function buildPrompt(input: GenerateInput): string {
  const { teams, teamA, competition, favourite } = input;
  const teamAName = teamA === "home" ? teams.home : teams.away;
  const favLine =
    favourite != null
      ? `The favourite is ${favourite === "home" ? teams.home : teams.away}.`
      : "No odds are available for this match.";

  return [
    `Match: ${teams.home} versus ${teams.away} in the ${competition}.`,
    `Home team is ${teams.home}, away team is ${teams.away}.`,
    `The three point question is already set to "${teamAName} to win".`,
    favLine,
    "",
    "Pick exactly four questions from this list for the one point slots:",
    catalogForPrompt(),
    "",
    "Rules:",
    "- Choose four different questions with a good mix of categories.",
    "- Do not pick anything about the overall match winner, that slot is taken.",
    "- For a question that needs a team, set team to home or away.",
    "- Make the set fun and not too easy to guess.",
    "",
    'Reply with only a JSON array, for example:',
    '[{"templateId":"over_2_5_goals"},{"templateId":"team_scores_first","team":"home"}]',
  ].join("\n");
}

function parseChoices(text: string): QuestionChoice[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return [];
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item.templateId === "string")
      .map((item) => ({
        templateId: item.templateId as string,
        team: item.team === "home" || item.team === "away" ? item.team : undefined,
      }));
  } catch {
    return [];
  }
}

async function askModel(input: GenerateInput): Promise<QuestionChoice[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return [];

  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: process.env.QUESTION_MODEL || DEFAULT_MODEL,
    max_tokens: 400,
    messages: [{ role: "user", content: buildPrompt(input) }],
  });

  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  return parseChoices(text);
}

// Returns the five questions for a room. Never throws for question reasons: any
// failure falls back to a safe default set.
export async function generateQuestions(
  input: GenerateInput,
): Promise<SelectedQuestion[]> {
  let picks: QuestionChoice[] = [];
  try {
    picks = await askModel(input);
  } catch {
    picks = [];
  }
  if (picks.length === 0) {
    picks = defaultPicks(input.teamA);
  }
  // buildQuestions cleans the picks and tops up from the defaults as needed.
  return buildQuestions(input.teams, input.teamA, picks);
}
