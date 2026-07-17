"use client";

// The bookie. He runs the book for the room: takes the slips, calls the
// action, and reads out who pays at full time. Voice comes later; for now his
// words go on a paper chit next to him.
//
// He is rigged rather than redrawn: the arms are fixed paths inside groups that
// rotate around the shoulder, so a pose is a set of angles and framer can move
// between them. `mood` sets the resting face. `act` is a one shot performance
// for a match moment, which plays and then returns him to rest.

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export type RefereeMood = "neutral" | "hype" | "alarm" | "celebrate";

// An act plus the id of the event that caused it. The id is what makes a second
// goal perform again rather than sit still because the act name did not change.
export interface RefereeCue {
  act: RefereeAct;
  key: number;
}

export type RefereeAct =
  | "goal"
  | "yellow_card"
  | "red_card"
  | "penalty"
  | "var"
  | "corner"
  | "substitution"
  | "kickoff"
  | "half_time"
  | "full_time";

const SKIN = "#d9a26b";
const CAP = "#6b5637";
const CHALK = "#f2f4ec";
const INK = "#17150f";
const YELLOW = "#ffb520";
const RED = "#d7301f";
const PAPER = "#f4efe2";

// Joints. The arms hang from these and every pose is a rotation about them.
const L_SHOULDER = { x: 42, y: 74 };
const R_SHOULDER = { x: 78, y: 74 };
// Where each hand sits at rest. Anything held is drawn here and counter rotated
// by the pose angle, so it swings up with the arm and lands upright.
const L_HAND = { x: 26, y: 108 };
const R_HAND = { x: 94, y: 108 };

// A raised arm is roughly 135 degrees about the shoulder, swung out around the
// side rather than through the chest.
const RAISED = 135;

type Prop = "slip" | "yellow" | "red" | "board" | "watch" | "stamp" | null;

interface Pose {
  left: number; // left arm rotation about the left shoulder
  right: number; // right arm rotation about the right shoulder
  head: number; // head tilt
  bodyX: number;
  bodyY: number;
  jump?: boolean;
  whistle?: boolean; // whistle in his teeth, with a puff
  varBox?: boolean; // the rectangle drawn between both hands
  rightProp?: Prop;
  leftProp?: Prop;
}

const REST: Pose = { left: 0, right: 0, head: 0, bodyX: 0, bodyY: 0 };

// Every pose here maps to an event the feed actually reports. There is no foul
// and no free kick in the feed, so there is no pose for them.
const POSES: Record<RefereeAct, Pose> = {
  // Both arms up and a jump. The confetti comes from the flash.
  goal: { left: RAISED, right: -RAISED, head: -6, bodyX: 0, bodyY: 0, jump: true, rightProp: "slip" },
  yellow_card: { left: 0, right: -RAISED, head: 4, bodyX: 0, bodyY: 0, rightProp: "yellow" },
  // He pulls away from it. The card itself gets thrown by the flash.
  red_card: { left: 0, right: -RAISED, head: 6, bodyX: -4, bodyY: 0, rightProp: "red" },
  // The real gesture: whistle in the teeth, arm out to the spot.
  penalty: { left: 0, right: -56, head: 0, bodyX: 0, bodyY: 0, whistle: true },
  var: { left: 96, right: -96, head: 0, bodyX: 0, bodyY: 0, varBox: true },
  // Deliberately small. A corner is not an event.
  corner: { left: 22, right: -22, head: 3, bodyX: 0, bodyY: -1 },
  substitution: { left: 0, right: -RAISED, head: 0, bodyX: 0, bodyY: 0, rightProp: "board" },
  kickoff: { left: 0, right: -40, head: 0, bodyX: 0, bodyY: 0, whistle: true },
  half_time: { left: -70, right: 0, head: 8, bodyX: 0, bodyY: 0, leftProp: "watch" },
  full_time: {
    left: RAISED,
    right: -RAISED,
    head: -4,
    bodyX: 0,
    bodyY: 0,
    whistle: true,
    rightProp: "stamp",
  },
};

// How long he holds a pose before dropping back to rest.
const HOLD_MS = 1900;

const JOINT_SPRING = { type: "spring", duration: 0.5, bounce: 0.34 } as const;

function HeldProp({ prop }: { prop: Prop }) {
  switch (prop) {
    case "slip":
      return (
        <g>
          <rect x="-9" y="-12" width="18" height="24" rx="1.5" fill={PAPER} stroke={INK} strokeWidth="1.5" />
          <path d="M-6 -6 h12 M-6 -1 h12 M-6 4 h8" stroke={INK} strokeWidth="1.4" />
        </g>
      );
    case "yellow":
      return <rect x="-7" y="-11" width="14" height="22" rx="1.5" fill={YELLOW} stroke={INK} strokeWidth="1.2" />;
    case "red":
      return <rect x="-7" y="-11" width="14" height="22" rx="1.5" fill={RED} stroke={INK} strokeWidth="1.2" />;
    case "board":
      // The sub board: numbers off, numbers on.
      return (
        <g>
          <rect x="-11" y="-9" width="22" height="18" rx="2" fill={INK} stroke={CHALK} strokeWidth="1.2" />
          <text x="-5.5" y="2" fontSize="9" fontWeight="700" fill={RED} textAnchor="middle">
            7
          </text>
          <text x="5.5" y="2" fontSize="9" fontWeight="700" fill="#45b26b" textAnchor="middle">
            9
          </text>
        </g>
      );
    case "watch":
      return (
        <g>
          <circle cx="0" cy="0" r="6" fill={PAPER} stroke={INK} strokeWidth="1.5" />
          <path d="M0 -3 V0 L2.5 1.5" stroke={INK} strokeWidth="1.3" strokeLinecap="round" fill="none" />
        </g>
      );
    case "stamp":
      return (
        <g>
          <rect x="-9" y="-7" width="18" height="14" rx="1.5" fill={PAPER} stroke={RED} strokeWidth="1.5" />
          <text x="0" y="2.5" fontSize="4.6" fontWeight="700" fill={RED} textAnchor="middle">
            SETTLE
          </text>
        </g>
      );
    default:
      return null;
  }
}

function BookieFigure({ pose, mood }: { pose: Pose; mood: RefereeMood }) {
  return (
    <svg viewBox="0 0 120 130" width="92" height="100" role="img" aria-label="the bookie">
      <motion.g
        animate={{
          x: pose.bodyX,
          y: pose.jump ? [0, -9, 0] : pose.bodyY,
        }}
        transition={
          pose.jump
            ? { duration: 0.5, times: [0, 0.4, 1], ease: [0.23, 1, 0.32, 1] }
            : JOINT_SPRING
        }
      >
        {/* left arm, swinging from the shoulder */}
        <motion.g
          animate={{ rotate: pose.left }}
          transition={JOINT_SPRING}
          style={{ transformBox: "view-box", transformOrigin: `${L_SHOULDER.x}px ${L_SHOULDER.y}px` }}
        >
          <path
            d="M42 74 C32 84 25 96 26 108"
            fill="none"
            stroke={CHALK}
            strokeWidth="10"
            strokeLinecap="round"
          />
          <circle cx={L_HAND.x} cy={L_HAND.y} r="6" fill={SKIN} />
          {/* held things sit in the hand and unwind the arm's angle so they stay upright */}
          <AnimatePresence>
            {pose.leftProp && (
              <motion.g
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                transform={`translate(${L_HAND.x} ${L_HAND.y}) rotate(${-pose.left})`}
              >
                <HeldProp prop={pose.leftProp} />
              </motion.g>
            )}
          </AnimatePresence>
        </motion.g>

        {/* right arm */}
        <motion.g
          animate={{ rotate: pose.right }}
          transition={JOINT_SPRING}
          style={{ transformBox: "view-box", transformOrigin: `${R_SHOULDER.x}px ${R_SHOULDER.y}px` }}
        >
          <path
            d="M78 74 C88 84 95 96 94 108"
            fill="none"
            stroke={CHALK}
            strokeWidth="10"
            strokeLinecap="round"
          />
          <circle cx={R_HAND.x} cy={R_HAND.y} r="6" fill={SKIN} />
          <AnimatePresence>
            {pose.rightProp && (
              <motion.g
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                transform={`translate(${R_HAND.x} ${R_HAND.y}) rotate(${-pose.right})`}
              >
                <HeldProp prop={pose.rightProp} />
              </motion.g>
            )}
          </AnimatePresence>
        </motion.g>

        {/* the VAR rectangle, drawn in the air between his hands */}
        <AnimatePresence>
          {pose.varBox && (
            <motion.rect
              initial={{ opacity: 0, pathLength: 0 }}
              animate={{ opacity: 1, pathLength: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
              x="40"
              y="26"
              width="40"
              height="26"
              rx="2"
              fill="none"
              stroke={CHALK}
              strokeWidth="2.5"
              strokeDasharray="3 3"
            />
          )}
        </AnimatePresence>

        {/* waistcoat over a chalk shirt collar */}
        <path d="M42 70 C42 62 78 62 78 70 L83 116 C66 124 54 124 37 116 Z" fill={INK} />
        <path d="M52 66 L60 80 L68 66 C63 62 57 62 52 66 Z" fill={CHALK} />
        <path d="M47 74 L51 112 M73 74 L69 112" stroke={CHALK} strokeWidth="1.5" opacity="0.35" />

        {/* head, tilting on the neck */}
        <motion.g
          animate={{ rotate: pose.head }}
          transition={JOINT_SPRING}
          style={{ transformBox: "view-box", transformOrigin: "60px 64px" }}
        >
          <circle cx="60" cy="42" r="22" fill={SKIN} />
          <circle cx="38" cy="44" r="4.5" fill={SKIN} />
          <circle cx="82" cy="44" r="4.5" fill={SKIN} />
          {/* pencil behind the ear */}
          <rect x="79" y="30" width="4" height="16" rx="1.5" fill={YELLOW} transform="rotate(18 81 38)" />
          {/* flat cap */}
          <path d="M38 36 C38 20 82 20 82 36 C70 30 50 30 38 36 Z" fill={CAP} />
          <path d="M34 36 C50 28 70 28 86 36 L84 41 C68 34 52 34 36 41 Z" fill={CAP} />
          {/* glasses */}
          <circle cx="51" cy="45" r="7" fill="none" stroke={INK} strokeWidth="2.5" />
          <circle cx="69" cy="45" r="7" fill="none" stroke={INK} strokeWidth="2.5" />
          <path d="M58 45 L62 45" stroke={INK} strokeWidth="2.5" />
          {/* eyes change with the mood */}
          {mood === "alarm" ? (
            <>
              <path d="M48 44 l6 3 M54 44 l-6 3" stroke={INK} strokeWidth="2" strokeLinecap="round" />
              <path d="M72 44 l-6 3 M66 44 l6 3" stroke={INK} strokeWidth="2" strokeLinecap="round" />
            </>
          ) : (
            <>
              <circle cx="51" cy="45" r={mood === "neutral" ? 2 : 2.6} fill={INK} />
              <circle cx="69" cy="45" r={mood === "neutral" ? 2 : 2.6} fill={INK} />
            </>
          )}
          {/* moustache and mouth */}
          <path d="M52 56 C56 53 64 53 68 56 C64 58 56 58 52 56 Z" fill="#57523f" />
          {mood === "neutral" ? (
            <path d="M56 61 C58 63 62 63 64 61" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
          ) : (
            <ellipse cx="60" cy="62" rx={mood === "alarm" ? 4 : 5.5} ry={mood === "alarm" ? 3 : 4.5} fill={INK} />
          )}
          {/* whistle in his teeth, with a puff of air */}
          <AnimatePresence>
            {pose.whistle && (
              <motion.g
                initial={{ opacity: 0, x: -3 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <rect x="62" y="59" width="13" height="6" rx="2.5" fill={CHALK} stroke={INK} strokeWidth="1.2" />
                <circle cx="72" cy="62" r="1.4" fill={INK} />
                <motion.g
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: [0, 1, 0], scale: [0.6, 1.15, 1.3] }}
                  transition={{ duration: 0.6, times: [0, 0.35, 1], ease: [0.23, 1, 0.32, 1] }}
                  style={{ transformBox: "view-box", transformOrigin: "78px 62px" }}
                >
                  <path
                    d="M79 58 q5 4 0 8 M83 55 q8 7 0 14"
                    fill="none"
                    stroke={CHALK}
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </motion.g>
              </motion.g>
            )}
          </AnimatePresence>
        </motion.g>
      </motion.g>
    </svg>
  );
}

export function Referee({
  mood = "neutral",
  line,
  act,
}: {
  mood?: RefereeMood;
  line: string;
  act?: RefereeCue | null;
}) {
  // An act plays once and then he settles back to rest. No idle loop: he is
  // still between moments, which is what makes the moments land.
  const [pose, setPose] = useState<Pose>(REST);

  useEffect(() => {
    if (!act) return;
    setPose(POSES[act.act]);
    const timer = setTimeout(() => setPose(REST), HOLD_MS);
    return () => clearTimeout(timer);
  }, [act?.act, act?.key]);

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
      <div style={{ flexShrink: 0 }}>
        <BookieFigure pose={pose} mood={mood} />
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          aria-live="polite"
          key={line}
          initial={{ opacity: 0, scale: 0.96, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
          transition={{ type: "spring", duration: 0.35, bounce: 0.2 }}
          className="slip"
          style={{
            padding: "10px 14px",
            fontSize: 13,
            fontWeight: 700,
            lineHeight: 1.4,
            marginBottom: 22,
            transform: "rotate(-0.6deg)",
            borderRadius: 3,
          }}
        >
          {line}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
