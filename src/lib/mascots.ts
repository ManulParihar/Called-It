// The roster of characters a player can pick. Both the sign in screen and the
// leaderboard use this list. The art for each one is added during UI work; here
// we just fix the ids and names so everything lines up.

export interface Mascot {
  id: string;
  name: string;
}

export const MASCOTS: Mascot[] = [
  { id: "fox", name: "The Fox" },
  { id: "bull", name: "The Bull" },
  { id: "owl", name: "The Owl" },
  { id: "shark", name: "The Shark" },
  { id: "ram", name: "The Ram" },
  { id: "cobra", name: "The Cobra" },
  { id: "panther", name: "The Panther" },
  { id: "eagle", name: "The Eagle" },
];

export const MASCOT_IDS = MASCOTS.map((m) => m.id);

export function isMascotId(value: string): boolean {
  return MASCOT_IDS.includes(value);
}
