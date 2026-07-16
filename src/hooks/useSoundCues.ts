"use client";

// Placeholder for sound. The live screen already calls cue() at the right
// moments, so when audio lands it only needs to fill in this hook. Until then
// it does nothing, on purpose.

export type SoundCue =
  | "goal"
  | "red_card"
  | "penalty"
  | "var"
  | "whistle"
  | "win"
  | "forfeit";

export function useSoundCues(): { cue: (name: SoundCue) => void } {
  return {
    cue: () => {
      // Audio comes later.
    },
  };
}
