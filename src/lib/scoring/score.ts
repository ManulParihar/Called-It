// Turns answers and resolved questions into points and a leaderboard.
//
// A player earns a question's points when their swipe matches the outcome: they
// swiped yes and it happened, or they swiped no and it did not. Questions that
// are still pending or that were voided award nothing.

import type {
  Answer,
  LeaderboardEntry,
  Member,
  Question,
} from "../types";

export function scoreMembers(
  members: Member[],
  questions: Question[],
  answers: Answer[],
): Map<string, number> {
  const pointsByQuestion = new Map<string, { outcome: string; points: number }>();
  for (const q of questions) {
    pointsByQuestion.set(q.id, { outcome: q.outcome, points: q.points });
  }

  const totals = new Map<string, number>();
  for (const member of members) totals.set(member.id, 0);

  for (const answer of answers) {
    const q = pointsByQuestion.get(answer.questionId);
    if (!q) continue;
    if (q.outcome !== "yes" && q.outcome !== "no") continue;
    if (answer.choice === q.outcome) {
      totals.set(answer.memberId, (totals.get(answer.memberId) ?? 0) + q.points);
    }
  }

  return totals;
}

// Builds the ordered leaderboard. Players are sorted by points, then by join
// time so the order is stable. Tied players share a rank. Everyone on the top
// score is a winner. The lowest score is the loser, unless every player is tied,
// in which case there is no loser.
export function buildLeaderboard(
  members: Member[],
  questions: Question[],
  answers: Answer[],
): LeaderboardEntry[] {
  const totals = scoreMembers(members, questions, answers);

  const ordered = [...members].sort((a, b) => {
    const diff = (totals.get(b.id) ?? 0) - (totals.get(a.id) ?? 0);
    if (diff !== 0) return diff;
    return a.joinedAt.localeCompare(b.joinedAt);
  });

  if (ordered.length === 0) return [];

  const scores = ordered.map((m) => totals.get(m.id) ?? 0);
  const maxPoints = Math.max(...scores);
  const minPoints = Math.min(...scores);
  const everyoneTied = maxPoints === minPoints;

  const entries: LeaderboardEntry[] = [];
  let rank = 0;
  let lastPoints: number | null = null;

  ordered.forEach((member, index) => {
    const points = totals.get(member.id) ?? 0;
    // Competition ranking: a new score takes the next position, ties keep the
    // rank of the first player on that score.
    if (points !== lastPoints) {
      rank = index + 1;
      lastPoints = points;
    }
    entries.push({
      memberId: member.id,
      displayName: member.displayName,
      mascotId: member.mascotId,
      points,
      rank,
      isWinner: points === maxPoints,
      isLoser: !everyoneTied && points === minPoints,
    });
  });

  return entries;
}
