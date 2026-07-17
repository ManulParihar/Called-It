"use client";

// The eight club crests. Football clubs are literally nicknamed after animals
// — the Foxes, the Owls, the Rams — so each player picks a club badge, drawn
// as inline SVG. Every crest gets its own shape, kit colour and mark so they
// stay tellable-apart at leaderboard size (38px).

import { useId, type ReactNode } from "react";
import { MASCOTS } from "@/lib/mascots";

const CHALK = "#f2f4ec";
const INK = "#17150f";
const KEYLINE = "rgba(242,244,236,0.35)";

const SHIELD = "M50 5 L86 14 C86 48 74 78 50 95 C26 78 14 48 14 14 Z";

interface Crest {
  shape: "shield" | "circle";
  field: string; // kit colour
  rim: string; // darker edge
  striped?: boolean; // chalk stripes on the field
  mark: ReactNode; // the animal, flat and chunky
}

const CRESTS: Record<string, Crest> = {
  fox: {
    shape: "shield",
    field: "#e87f1a",
    rim: "#9e5410",
    mark: (
      <>
        {/* fox mask: ears, face, snout tip */}
        <path
          d="M30 32 L37 15 L46 28 L54 28 L63 15 L70 32 L50 64 Z"
          fill={CHALK}
        />
        <circle cx="42" cy="37" r="3" fill={INK} />
        <circle cx="58" cy="37" r="3" fill={INK} />
        <path d="M46 52 L54 52 L50 60 Z" fill={INK} />
      </>
    ),
  },
  bull: {
    shape: "circle",
    field: "#b3261e",
    rim: "#711512",
    mark: (
      <>
        {/* horns swept up and out, long face below */}
        <path d="M39 33 C27 33 16 24 16 11 C24 20 33 23 42 24 Z" fill={CHALK} />
        <path d="M61 33 C73 33 84 24 84 11 C76 20 67 23 58 24 Z" fill={CHALK} />
        <path
          d="M50 24 C61 24 67 35 66 48 C65 61 58 71 50 71 C42 71 35 61 34 48 C33 35 39 24 50 24 Z"
          fill={CHALK}
        />
        <circle cx="43.5" cy="41" r="2.8" fill="#b3261e" />
        <circle cx="56.5" cy="41" r="2.8" fill="#b3261e" />
        <circle cx="45.5" cy="61" r="2.2" fill="#b3261e" />
        <circle cx="54.5" cy="61" r="2.2" fill="#b3261e" />
      </>
    ),
  },
  owl: {
    shape: "shield",
    field: "#24487e",
    rim: "#16294a",
    striped: true,
    mark: (
      <>
        {/* tufts, two big round eyes, a beak */}
        <path d="M28 33 L33 18 L41 29 Z" fill={CHALK} />
        <path d="M72 33 L67 18 L59 29 Z" fill={CHALK} />
        <circle cx="38" cy="42" r="11" fill={CHALK} />
        <circle cx="62" cy="42" r="11" fill={CHALK} />
        <circle cx="38" cy="42" r="4.5" fill={INK} />
        <circle cx="62" cy="42" r="4.5" fill={INK} />
        <path d="M44 56 L56 56 L50 67 Z" fill="#ffb520" />
      </>
    ),
  },
  shark: {
    shape: "circle",
    field: "#1c5f7a",
    rim: "#103a4c",
    mark: (
      <>
        {/* the fin breaking the water */}
        <path d="M40 56 C41 37 50 24 64 20 C57 33 57 47 59 56 Z" fill={CHALK} />
        <path
          d="M24 65 Q30 58 36 65 T48 65 T60 65 T72 65"
          fill="none"
          stroke={CHALK}
          strokeWidth="4"
          strokeLinecap="round"
        />
      </>
    ),
  },
  ram: {
    shape: "shield",
    field: "#e9e2cf",
    rim: "#9c8f68",
    mark: (
      <>
        {/* curled horns flanking a narrow face */}
        <path
          d="M46 33 C34 20 17 27 19 42 C20 52 31 55 36 47 C39 42 36 36 31 37"
          fill="none"
          stroke="#4a3c22"
          strokeWidth="6.5"
          strokeLinecap="round"
        />
        <path
          d="M54 33 C66 20 83 27 81 42 C80 52 69 55 64 47 C61 42 64 36 69 37"
          fill="none"
          stroke="#4a3c22"
          strokeWidth="6.5"
          strokeLinecap="round"
        />
        <path
          d="M44 31 C44 25 56 25 56 31 L54 57 C52 62 48 62 46 57 Z"
          fill="#4a3c22"
        />
        <circle cx="47" cy="38" r="1.9" fill="#e9e2cf" />
        <circle cx="53" cy="38" r="1.9" fill="#e9e2cf" />
      </>
    ),
  },
  cobra: {
    shape: "circle",
    field: "#1e7a43",
    rim: "#124a28",
    mark: (
      <>
        {/* the flared hood, tapering to the body at the bottom */}
        <path
          d="M50 11 C69 15 79 32 75 50 C72 61 63 68 54 70 L50 62 L46 70 C37 68 28 61 25 50 C21 32 31 15 50 11 Z"
          fill={CHALK}
        />
        {/* narrowed eyes and a forked tongue */}
        <path d="M36 30 L47 34 L36 37 Z" fill="#1e7a43" />
        <path d="M64 30 L53 34 L64 37 Z" fill="#1e7a43" />
        <path
          d="M50 44 L50 54 M50 54 L45 60 M50 54 L55 60"
          fill="none"
          stroke="#d7301f"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </>
    ),
  },
  panther: {
    shape: "shield",
    field: "#1b1913",
    rim: "#3a3527",
    mark: (
      <>
        {/* amber cat, ears up, eyes narrowed */}
        <path d="M36 36 L39 21 L48 31 Z" fill="#ffb520" />
        <path d="M64 36 L61 21 L52 31 Z" fill="#ffb520" />
        <circle cx="50" cy="44" r="15" fill="#ffb520" />
        <ellipse cx="44" cy="42" rx="3" ry="4.2" fill="#1b1913" />
        <ellipse cx="56" cy="42" rx="3" ry="4.2" fill="#1b1913" />
        <path d="M46 51 L54 51 L50 56 Z" fill="#1b1913" />
      </>
    ),
  },
  eagle: {
    shape: "circle",
    field: "#d9a62e",
    rim: "#8f6c14",
    mark: (
      <>
        {/* broad solid wings, head and tail */}
        <path d="M48 40 L13 27 C17 43 29 54 46 55 Z" fill={INK} />
        <path d="M52 40 L87 27 C83 43 71 54 54 55 Z" fill={INK} />
        <path d="M50 32 L57 50 L50 74 L43 50 Z" fill={INK} />
        <circle cx="50" cy="28" r="6.5" fill={INK} />
        <path d="M55 25 L62 28 L55 31 Z" fill={INK} />
        <path d="M43 66 L50 79 L57 66 Z" fill={INK} />
      </>
    ),
  },
};

const FALLBACK: Crest = {
  shape: "shield",
  field: "#57523f",
  rim: "#3a3527",
  mark: <circle cx="50" cy="44" r="14" fill={CHALK} />,
};

const NAMES = new Map(MASCOTS.map((m) => [m.id, m.name]));

export function MascotAvatar({
  mascotId,
  size = 64,
  className,
}: {
  mascotId: string;
  size?: number;
  className?: string;
}) {
  const uid = useId();
  const crest = CRESTS[mascotId] ?? FALLBACK;
  const clipId = `crest-${uid}`;

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={NAMES.get(mascotId) ?? mascotId}
    >
      {crest.shape === "shield" ? (
        <>
          <clipPath id={clipId}>
            <path d={SHIELD} />
          </clipPath>
          <path d={SHIELD} fill={crest.field} />
          {crest.striped && (
            <g clipPath={`url(#${clipId})`} fill="rgba(242,244,236,0.16)">
              <rect x="26" y="0" width="10" height="100" />
              <rect x="45" y="0" width="10" height="100" />
              <rect x="64" y="0" width="10" height="100" />
            </g>
          )}
          <path
            d={SHIELD}
            fill="none"
            stroke={crest.rim}
            strokeWidth="4"
          />
          <path
            d={SHIELD}
            fill="none"
            stroke={KEYLINE}
            strokeWidth="1.5"
            transform="translate(50 50) scale(0.88) translate(-50 -50)"
          />
        </>
      ) : (
        <>
          <circle cx="50" cy="50" r="45" fill={crest.field} />
          {crest.striped && (
            <g fill="rgba(242,244,236,0.16)">
              <rect x="26" y="8" width="10" height="84" />
              <rect x="45" y="5" width="10" height="90" />
              <rect x="64" y="8" width="10" height="84" />
            </g>
          )}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke={crest.rim}
            strokeWidth="4"
          />
          <circle cx="50" cy="50" r="39" fill="none" stroke={KEYLINE} strokeWidth="1.5" />
        </>
      )}
      {crest.mark}
    </svg>
  );
}
