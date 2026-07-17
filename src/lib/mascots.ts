// The roster of characters a player can pick. Both the sign in screen and the
// leaderboard use this list. The art for each one is added during UI work; here
// we just fix the ids and names so everything lines up.

export interface Mascot {
  id: string;
  name: string;
}

export const MASCOTS: Mascot[] = [
  { id: "fox", name: "The Foxes" },
  { id: "bull", name: "The Bulls" },
  { id: "owl", name: "The Owls" },
  { id: "shark", name: "The Sharks" },
  { id: "ram", name: "The Rams" },
  { id: "cobra", name: "The Cobras" },
  { id: "panther", name: "The Panthers" },
  { id: "eagle", name: "The Eagles" },
];

export const MASCOT_IDS = MASCOTS.map((m) => m.id);

export function isMascotId(value: string): boolean {
  return MASCOT_IDS.includes(value);
}
