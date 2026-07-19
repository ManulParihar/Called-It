import assert from "node:assert/strict";
import { test } from "node:test";
import { scoresToReplayLines } from "../src/server/txline/history";

// A snapshot in the shape the historical endpoint actually sends: the phase as
// StatusId, the clock in seconds, the action as a plain string, and the running
// tallies nested under Score.ParticipantN.Total.
function snapshot(
  seq: number,
  fields: {
    status?: number;
    seconds?: number;
    action?: string;
    participant?: 1 | 2;
    p1?: Record<string, number>;
    p2?: Record<string, number>;
  },
) {
  return {
    FixtureId: 1,
    Participant1IsHome: true,
    Seq: seq,
    Ts: 1_700_000_000_000 + seq * 60_000,
    StatusId: fields.status,
    Action: fields.action ?? "possession",
    Participant: fields.participant,
    Clock: { Running: true, Seconds: fields.seconds ?? seq * 60 },
    Score: {
      Participant1: { Total: fields.p1 ?? {} },
      Participant2: { Total: fields.p2 ?? {} },
    },
  };
}

test("a recorded match reads out its phases, goals and cards", () => {
  const lines = scoresToReplayLines([
    snapshot(1, { status: 1, seconds: 0 }),
    snapshot(2, { status: 2, seconds: 0 }),
    snapshot(3, { status: 2, action: "goal", p1: { Goals: 1 } }),
    snapshot(4, { status: 2, action: "yellow_card", p1: { Goals: 1 }, p2: { YellowCards: 1 } }),
    snapshot(5, { status: 3, p1: { Goals: 1 }, p2: { YellowCards: 1 } }),
    snapshot(6, { status: 4, p1: { Goals: 1 }, p2: { YellowCards: 1 } }),
    snapshot(7, { status: 4, action: "goal", p1: { Goals: 1 }, p2: { Goals: 2, YellowCards: 1 } }),
    snapshot(8, { status: 5, p1: { Goals: 1 }, p2: { Goals: 2, YellowCards: 1 } }),
  ]);

  assert.deepEqual(
    lines.map((l) => l.kind),
    [
      "phase_change",
      "phase_change",
      "goal",
      "yellow_card",
      "phase_change",
      "phase_change",
      "goal",
      "goal",
      "phase_change",
    ],
  );
  assert.equal(lines.filter((l) => l.kind === "goal" && l.team === "home").length, 1);
  assert.equal(lines.filter((l) => l.kind === "goal" && l.team === "away").length, 2);
});

test("a disallowed goal is taken back rather than counted twice", () => {
  const lines = scoresToReplayLines([
    snapshot(1, { status: 2, seconds: 0 }),
    snapshot(2, { status: 2, action: "goal", p2: { Goals: 1 } }),
    snapshot(3, { status: 2, action: "action_discarded", p2: { Goals: 0 } }),
    snapshot(4, { status: 2, action: "goal", p2: { Goals: 1 } }),
  ]);

  assert.equal(lines.filter((l) => l.kind === "goal").length, 1);
});

test("the away side is read from which participant is at home", () => {
  const away = { ...snapshot(1, { status: 2, action: "goal", p1: { Goals: 1 } }), Participant1IsHome: false };
  const [line] = scoresToReplayLines([away]).filter((l) => l.kind === "goal");
  assert.equal(line.team, "away");
});

test("penalties and VAR come from the action name", () => {
  const lines = scoresToReplayLines([
    snapshot(1, { status: 2, seconds: 0 }),
    snapshot(2, { status: 2, action: "penalty", participant: 1 }),
    snapshot(3, { status: 2, action: "var" }),
    snapshot(4, { status: 2, action: "var_end" }),
  ]);

  const kinds = lines.map((l) => l.kind);
  assert.ok(kinds.includes("penalty_awarded"));
  assert.equal(kinds.filter((k) => k === "var_review").length, 1);
});
