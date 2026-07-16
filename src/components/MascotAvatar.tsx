"use client";

// The eight masked fighters, drawn as inline SVG so they scale anywhere and
// need no image files. Every mascot shares the same lucha mask base and gets
// its own colours and animal features on top.

import type { ReactNode } from "react";

interface MaskStyle {
  base: string; // mask colour
  trim: string; // forehead diamond and stitching
  skin: string; // muzzle showing through the mouth hole
  features?: ReactNode; // ears, horns, fins drawn behind the head
  extras?: ReactNode; // details drawn on top of the mask
}

const STYLES: Record<string, MaskStyle> = {
  fox: {
    base: "#ff8c1a",
    trim: "#ffcf3f",
    skin: "#ffe9c9",
    features: (
      <>
        {/* pointed ears */}
        <path d="M22 34 L14 8 L38 22 Z" fill="#ff8c1a" stroke="#c95f00" strokeWidth="2" />
        <path d="M78 34 L86 8 L62 22 Z" fill="#ff8c1a" stroke="#c95f00" strokeWidth="2" />
        <path d="M22 28 L18 14 L32 22 Z" fill="#ffe9c9" />
        <path d="M78 28 L82 14 L68 22 Z" fill="#ffe9c9" />
      </>
    ),
  },
  bull: {
    base: "#b52b3d",
    trim: "#ffcf3f",
    skin: "#e8a68b",
    features: (
      <>
        {/* curved horns */}
        <path d="M24 30 C6 26 4 12 12 6 C12 18 20 22 30 22 Z" fill="#fff3e2" stroke="#c9b8a0" strokeWidth="2" />
        <path d="M76 30 C94 26 96 12 88 6 C88 18 80 22 70 22 Z" fill="#fff3e2" stroke="#c9b8a0" strokeWidth="2" />
      </>
    ),
    extras: (
      // nose ring
      <circle cx="50" cy="83" r="6" fill="none" stroke="#ffcf3f" strokeWidth="3" />
    ),
  },
  owl: {
    base: "#6b3fa0",
    trim: "#c8f527",
    skin: "#d9c4f2",
    features: (
      <>
        {/* feather tufts */}
        <path d="M26 26 L18 6 L40 16 Z" fill="#6b3fa0" stroke="#4a2a73" strokeWidth="2" />
        <path d="M74 26 L82 6 L60 16 Z" fill="#6b3fa0" stroke="#4a2a73" strokeWidth="2" />
      </>
    ),
    extras: (
      // small beak over the mouth
      <path d="M44 74 L56 74 L50 86 Z" fill="#ffcf3f" stroke="#c95f00" strokeWidth="2" />
    ),
  },
  shark: {
    base: "#3f7fe8",
    trim: "#fff3e2",
    skin: "#cfe4ff",
    features: (
      // dorsal fin
      <path d="M50 2 C62 8 64 20 58 28 L42 28 C38 16 42 8 50 2 Z" fill="#3f7fe8" stroke="#215bb8" strokeWidth="2" />
    ),
    extras: (
      // teeth
      <path d="M38 80 l4 5 4 -5 4 5 4 -5 4 5 4 -5" fill="none" stroke="#fff3e2" strokeWidth="3" strokeLinejoin="round" />
    ),
  },
  ram: {
    base: "#e8dcc4",
    trim: "#ff2e88",
    skin: "#f7efe0",
    features: (
      <>
        {/* curled horns */}
        <path d="M30 30 C10 30 8 12 20 8 C16 18 24 24 34 20 Z" fill="#d9a53f" stroke="#a8781f" strokeWidth="2" />
        <path d="M70 30 C90 30 92 12 80 8 C84 18 76 24 66 20 Z" fill="#d9a53f" stroke="#a8781f" strokeWidth="2" />
        <circle cx="19" cy="19" r="7" fill="#d9a53f" stroke="#a8781f" strokeWidth="2" />
        <circle cx="81" cy="19" r="7" fill="#d9a53f" stroke="#a8781f" strokeWidth="2" />
      </>
    ),
  },
  cobra: {
    base: "#2f9e44",
    trim: "#c8f527",
    skin: "#bfe8c5",
    features: (
      // hood flares
      <path d="M50 4 C20 8 8 34 14 58 L28 46 L28 22 L72 22 L72 46 L86 58 C92 34 80 8 50 4 Z" fill="#2f9e44" stroke="#1d6b2c" strokeWidth="2" />
    ),
    extras: (
      // forked tongue
      <path d="M50 88 v6 m0 0 l-4 5 m4 -5 l4 5" fill="none" stroke="#ff4242" strokeWidth="3" strokeLinecap="round" />
    ),
  },
  panther: {
    base: "#2b2140",
    trim: "#ff2e88",
    skin: "#8f7fb0",
    features: (
      <>
        {/* round ears */}
        <circle cx="26" cy="20" r="12" fill="#2b2140" stroke="#171026" strokeWidth="2" />
        <circle cx="74" cy="20" r="12" fill="#2b2140" stroke="#171026" strokeWidth="2" />
        <circle cx="26" cy="20" r="5" fill="#ff2e88" />
        <circle cx="74" cy="20" r="5" fill="#ff2e88" />
      </>
    ),
    extras: (
      // whisker dots
      <>
        <circle cx="41" cy="80" r="1.8" fill="#171026" />
        <circle cx="50" cy="82" r="1.8" fill="#171026" />
        <circle cx="59" cy="80" r="1.8" fill="#171026" />
      </>
    ),
  },
  eagle: {
    base: "#c9a227",
    trim: "#fff3e2",
    skin: "#f2e3b8",
    features: (
      // head feathers
      <path d="M30 22 L24 4 L40 14 L44 2 L52 14 L62 4 L70 22 Z" fill="#c9a227" stroke="#8f6f12" strokeWidth="2" />
    ),
    extras: (
      // hooked beak
      <path d="M42 72 L58 72 C60 80 56 88 50 90 C46 86 42 80 42 72 Z" fill="#ff8c1a" stroke="#c95f00" strokeWidth="2" />
    ),
  },
};

const FALLBACK: MaskStyle = {
  base: "#ff2e88",
  trim: "#ffcf3f",
  skin: "#ffd9e8",
};

export function MascotAvatar({
  mascotId,
  size = 64,
  className,
}: {
  mascotId: string;
  size?: number;
  className?: string;
}) {
  const s = STYLES[mascotId] ?? FALLBACK;
  const darker = "rgba(0,0,0,0.28)";

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={mascotId}
    >
      {s.features}
      {/* head with the mask pulled over it */}
      <path
        d="M50 10 C26 10 16 26 16 46 C16 72 32 92 50 96 C68 92 84 72 84 46 C84 26 74 10 50 10 Z"
        fill={s.base}
        stroke={darker}
        strokeWidth="3"
      />
      {/* forehead diamond, the classic lucha panel */}
      <path d="M50 16 L62 34 L50 52 L38 34 Z" fill={s.trim} opacity="0.95" />
      {/* stitch line down the middle */}
      <path
        d="M50 52 L50 68"
        stroke={darker}
        strokeWidth="2"
        strokeDasharray="3 4"
      />
      {/* eye holes */}
      <path d="M24 50 C26 40 38 40 42 48 C42 56 30 60 24 50 Z" fill="#180a26" />
      <path d="M76 50 C74 40 62 40 58 48 C58 56 70 60 76 50 Z" fill="#180a26" />
      <circle cx="33" cy="49" r="4" fill="#fff3e2" />
      <circle cx="67" cy="49" r="4" fill="#fff3e2" />
      <circle cx="34.5" cy="48" r="1.6" fill="#180a26" />
      <circle cx="65.5" cy="48" r="1.6" fill="#180a26" />
      {/* mouth opening showing the animal underneath */}
      <path
        d="M36 72 C36 64 64 64 64 72 C64 82 56 88 50 88 C44 88 36 82 36 72 Z"
        fill={s.skin}
        stroke={darker}
        strokeWidth="2.5"
      />
      <path d="M43 76 C46 80 54 80 57 76" fill="none" stroke="#180a26" strokeWidth="2.5" strokeLinecap="round" />
      {s.extras}
    </svg>
  );
}
