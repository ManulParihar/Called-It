// Splits a money pot between players based on the payout mode.
//
// All amounts are in whole cents so the shares always add up to the pot with no
// rounding drift. Leftover cents from a split are handed out one at a time to
// the highest ranked players first.

import type { LeaderboardEntry, PayoutMode, PayoutShare } from "../types";

interface Weight {
  memberId: string;
  weight: number;
}

// Splits the pot in proportion to the given weights. Any cents left over after
// the proportional split go to the earliest members in the list, which are the
// highest ranked because the leaderboard is already ordered.
function allocate(weights: Weight[], potCents: number): PayoutShare[] {
  const total = weights.reduce((sum, w) => sum + w.weight, 0);

  if (potCents <= 0 || total <= 0) {
    return weights.map((w) => ({ memberId: w.memberId, amountCents: 0 }));
  }

  const shares = weights.map((w) => {
    const exact = (potCents * w.weight) / total;
    const whole = Math.floor(exact);
    return { memberId: w.memberId, amountCents: whole, remainder: exact - whole };
  });

  let assigned = shares.reduce((sum, s) => sum + s.amountCents, 0);
  let leftover = potCents - assigned;

  // Hand out remaining cents by the largest fractional part first, keeping the
  // list order as the tie breaker.
  const order = [...shares]
    .map((s, index) => ({ index, remainder: s.remainder }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);

  for (const item of order) {
    if (leftover <= 0) break;
    shares[item.index].amountCents += 1;
    leftover -= 1;
  }

  return shares.map((s) => ({ memberId: s.memberId, amountCents: s.amountCents }));
}

// Position weights for the top three split. Ties are handled by the caller,
// which sums the weights of the tied positions and splits them equally.
const TOP_THREE_WEIGHTS = [50, 30, 20];

// Groups leaderboard entries by points, preserving order. Each group is a set of
// tied players.
function tieGroups(leaderboard: LeaderboardEntry[]): LeaderboardEntry[][] {
  const groups: LeaderboardEntry[][] = [];
  let current: LeaderboardEntry[] = [];
  let lastPoints: number | null = null;

  for (const entry of leaderboard) {
    if (entry.points !== lastPoints) {
      if (current.length > 0) groups.push(current);
      current = [];
      lastPoints = entry.points;
    }
    current.push(entry);
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

// Builds per member weights for a position based mode by summing the position
// weights across each tie group and splitting them equally within the group.
function positionWeights(
  leaderboard: LeaderboardEntry[],
  weightAt: (position: number) => number,
): Weight[] {
  const weights: Weight[] = [];
  let position = 0;

  for (const group of tieGroups(leaderboard)) {
    let groupTotal = 0;
    for (let i = 0; i < group.length; i++) {
      groupTotal += weightAt(position + i);
    }
    const each = groupTotal / group.length;
    for (const entry of group) {
      weights.push({ memberId: entry.memberId, weight: each });
    }
    position += group.length;
  }

  return weights;
}

export function computePayouts(
  mode: PayoutMode,
  leaderboard: LeaderboardEntry[],
  potCents: number,
): PayoutShare[] {
  if (leaderboard.length === 0) return [];

  switch (mode) {
    case "winner_takes_all": {
      // Only the top score has weight. Tied winners split it equally.
      const weights = positionWeights(leaderboard, (pos) => (pos === 0 ? 1 : 0));
      return allocate(weights, potCents);
    }

    case "top_three": {
      const weights = positionWeights(
        leaderboard,
        (pos) => TOP_THREE_WEIGHTS[pos] ?? 0,
      );
      return allocate(weights, potCents);
    }

    case "all_but_loser": {
      // Everyone except the loser shares in proportion to their points. If no
      // one has any points the pot is split evenly so the money is not stuck.
      const anyPoints = leaderboard.some((e) => !e.isLoser && e.points > 0);
      const weights: Weight[] = leaderboard.map((entry) => ({
        memberId: entry.memberId,
        weight: entry.isLoser ? 0 : anyPoints ? entry.points : 1,
      }));
      return allocate(weights, potCents);
    }
  }
}
