"use client";

// Sound for the loud match moments. The live and full-time screens already call
// cue() at the right beats; this hook is what finally makes noise.
//
// Design notes:
//   - Only a few clips ship (goal, oooh, whistle, lose). A cue with no asset is
//     simply silent — nothing throws — so the app works with any subset present.
//   - iOS blocks audio until a user gesture. We prime every clip on the first
//     tap/key, so later cues (a goal mid-match) play without one.
//   - Mute is global and remembered in localStorage, so a phone kept quiet for a
//     recording stays quiet across screens and reloads.

import { useCallback, useEffect, useSyncExternalStore } from "react";

export type SoundCue =
  | "goal"
  | "red_card"
  | "yellow_card"
  | "penalty"
  | "var"
  | "whistle"
  | "full_time"
  | "win"
  | "lose"
  | "forfeit"
  | "tick";

// Each cue maps to a file basename in /public/audio (or null when nothing ships
// for it yet — that cue is quiet until an asset lands).
const CUE_FILE: Record<SoundCue, string | null> = {
  goal: "goal",
  win: "goal", // the goal shout doubles as a full-time celebration
  red_card: "oooh",
  yellow_card: "oooh",
  penalty: "oooh",
  var: "oooh",
  whistle: "whistle",
  full_time: "whistle",
  lose: "lose",
  forfeit: "lose",
  tick: null, // no click asset yet
};

const MUTE_KEY = "called-it:muted";

// --- module-level audio + mute store (shared across every hook caller) -------

const cache = new Map<string, HTMLAudioElement>();
let muted = false;
let hydrated = false;
let unlocked = false;
let unlockArmed = false;
const subscribers = new Set<() => void>();

function emit() {
  subscribers.forEach((fn) => fn());
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    muted = window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    // Private mode / blocked storage: default to unmuted.
  }
}

function audioFor(file: string): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  let el = cache.get(file);
  if (!el) {
    el = new Audio(`/audio/${file}.mp3`);
    el.preload = "auto";
    cache.set(file, el);
  }
  return el;
}

const distinctFiles = () =>
  Array.from(new Set(Object.values(CUE_FILE).filter((f): f is string => !!f)));

// Play then immediately pause each clip once, inside a gesture, so iOS marks
// them playable for the rest of the session.
function unlock() {
  if (unlocked || typeof window === "undefined") return;
  unlocked = true;
  for (const file of distinctFiles()) {
    const el = audioFor(file);
    if (!el) continue;
    const prevMuted = el.muted;
    el.muted = true;
    el
      .play()
      .then(() => {
        el.pause();
        el.currentTime = 0;
        el.muted = prevMuted;
      })
      .catch(() => {
        el.muted = prevMuted;
      });
  }
}

function armUnlock() {
  if (unlockArmed || unlocked || typeof window === "undefined") return;
  unlockArmed = true;
  const handler = () => {
    unlock();
    window.removeEventListener("pointerdown", handler);
    window.removeEventListener("keydown", handler);
  };
  window.addEventListener("pointerdown", handler);
  window.addEventListener("keydown", handler);
}

function playCue(name: SoundCue) {
  hydrate();
  if (muted || typeof window === "undefined") return;
  const file = CUE_FILE[name];
  if (!file) return;
  const el = audioFor(file);
  if (!el) return;
  try {
    el.currentTime = 0;
  } catch {
    // Not seekable yet; play from wherever it is.
  }
  // A missing file or a not-yet-unlocked context just rejects — stay silent.
  el.play().catch(() => {});
}

function setMuted(next: boolean) {
  hydrate();
  muted = next;
  try {
    window.localStorage.setItem(MUTE_KEY, next ? "1" : "0");
  } catch {
    // ignore
  }
  if (next) cache.forEach((el) => el.pause());
  emit();
}

function subscribe(cb: () => void) {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

function getMutedSnapshot() {
  hydrate();
  return muted;
}

export function useSoundCues(): {
  cue: (name: SoundCue) => void;
  muted: boolean;
  toggleMute: () => void;
} {
  const isMuted = useSyncExternalStore(subscribe, getMutedSnapshot, () => false);

  useEffect(() => {
    armUnlock();
  }, []);

  const cue = useCallback((name: SoundCue) => playCue(name), []);
  const toggleMute = useCallback(() => setMuted(!muted), []);

  return { cue, muted: isMuted, toggleMute };
}
