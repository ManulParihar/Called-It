// Works out the outcome of each question from the current match state.

import { isVoid, type MatchState } from "../match";
import type { Question, QuestionOutcome } from "../types";
import { TEMPLATES_BY_ID } from "./bank";

// The outcome of one question right now. A voided match makes every open
// question void so no one gains or loses points from it.
export function resolveQuestion(
  question: Question,
  state: MatchState,
): QuestionOutcome {
  if (question.outcome !== "pending") return question.outcome;
  if (isVoid(state)) return "void";

  const template = TEMPLATES_BY_ID[question.templateId];
  if (!template) return "pending";
  return template.evaluate(state, question.team);
}

// Returns the questions whose outcome changed, with the new outcome and a
// resolved timestamp set. Questions that are still pending are left out so the
// caller only has to write the ones that moved.
export function resolveChanged(
  questions: Question[],
  state: MatchState,
): Question[] {
  const changed: Question[] = [];
  for (const question of questions) {
    const outcome = resolveQuestion(question, state);
    if (outcome !== question.outcome) {
      changed.push({
        ...question,
        outcome,
        resolvedAt: outcome === "pending" ? null : state.updatedAt,
      });
    }
  }
  return changed;
}
