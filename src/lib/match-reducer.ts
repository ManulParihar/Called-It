// Folds normalized match events into a running MatchState.
//
// The reducer is pure: give it the current state and an event, it returns the
// next state. This makes it easy to test and to replay a recorded match by
// applying events one at a time.

import type { MatchEvent, MatchState, TeamSide } from "./match";

function bump(counts: { home: number; away: number }, team: TeamSide) {
  return {
    home: counts.home + (team === "home" ? 1 : 0),
    away: counts.away + (team === "away" ? 1 : 0),
  };
}

export function applyEvent(state: MatchState, event: MatchEvent): MatchState {
  const next: MatchState = {
    ...state,
    goals: { ...state.goals },
    goalsFirstHalf: { ...state.goalsFirstHalf },
    goalsSecondHalf: { ...state.goalsSecondHalf },
    yellowCards: { ...state.yellowCards },
    redCards: { ...state.redCards },
    corners: { ...state.corners },
    updatedAt: event.receivedAt,
  };

  if (typeof event.minute === "number") {
    next.minute = Math.max(next.minute, event.minute);
  }

  switch (event.kind) {
    case "phase_change": {
      if (event.phase) {
        next.phase = event.phase;
        // When the match reaches half time, freeze the score at that point.
        if (event.phase === "half_time" && next.halfTimeScore === null) {
          next.halfTimeScore = { ...next.goals };
        }
      }
      break;
    }

    case "goal": {
      if (!event.team) break;
      next.goals = bump(next.goals, event.team);
      if (next.firstGoalTeam === null) next.firstGoalTeam = event.team;

      // Track which half the goal fell in. Extra time goals are not counted
      // toward the first or second half totals.
      if (next.phase === "first_half") {
        next.goalsFirstHalf = bump(next.goalsFirstHalf, event.team);
      } else if (next.phase === "second_half") {
        next.goalsSecondHalf = bump(next.goalsSecondHalf, event.team);
      }

      if (typeof event.minute === "number") {
        if (event.minute <= 15) next.goalInFirstFifteen = true;
        if (event.minute > 90) next.goalAfterNinety = true;
      }
      break;
    }

    case "yellow_card": {
      if (!event.team) break;
      next.yellowCards = bump(next.yellowCards, event.team);
      if (next.firstCardTeam === null) next.firstCardTeam = event.team;
      break;
    }

    case "red_card": {
      if (!event.team) break;
      next.redCards = bump(next.redCards, event.team);
      if (next.firstCardTeam === null) next.firstCardTeam = event.team;
      break;
    }

    case "corner": {
      if (!event.team) break;
      next.corners = bump(next.corners, event.team);
      break;
    }

    case "penalty_awarded": {
      next.penaltyAwarded = true;
      break;
    }

    case "var_review": {
      next.varReviewOccurred = true;
      break;
    }

    case "substitution": {
      // Tracked for the live ticker only. No question depends on it.
      break;
    }
  }

  return next;
}

export function applyEvents(state: MatchState, events: MatchEvent[]): MatchState {
  return events.reduce(applyEvent, state);
}
