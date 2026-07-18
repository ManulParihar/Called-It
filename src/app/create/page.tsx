"use client";

// Create a room in three steps: pick the fixture, pick your team, set the
// stakes. Then the room opens and the code is ready to share.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { createRoom, listFixtures, setRoomPool } from "@/lib/api";
import type { Fixture, PayoutMode, WagerType } from "@/lib/types";
import type { TeamSide } from "@/lib/match";
import { DEFAULT_FORFEITS } from "@/lib/forfeits";
import { StakeRoller } from "@/components/StakeRoller";
import { DribbleLoader } from "@/components/DribbleLoader";
import { useProfile } from "@/hooks/useProfile";
import { useAppWallet } from "@/lib/wallet/WalletProvider";
import { createPoolAndDeposit } from "@/lib/wallet/deposit";

const PAYOUT_LABELS: Record<PayoutMode, string> = {
  winner_takes_all: "Winner takes all",
  top_three: "Top 3 split",
  all_but_loser: "All but loser",
};

function kickoffLabel(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function matchDateLabel(iso: string): string {
  // "Sat 21 Jun": weekday, day, month, the way a fixture list prints it.
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function FixtureBadge({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontWeight: 700,
        fontSize: 10,
        letterSpacing: "0.14em",
        color,
        background: "var(--pitch-3)",
        border: "1px solid var(--chalk-line)",
        borderRadius: "var(--radius-sm)",
        padding: "3px 8px",
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  );
}

function FixtureCard({
  fixture,
  selected,
  onSelect,
}: {
  fixture: Fixture;
  selected?: boolean;
  onSelect?: (id: string) => void;
}) {
  if (fixture.kind === "upcoming") {
    // Future matches are on the board for flavour only: a plain div, never a
    // form control, so it cannot be clicked, focused or submitted.
    return (
      <div className="card" style={{ opacity: 0.55 }} aria-disabled="true">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <p className="eyebrow" style={{ flex: 1 }}>
            {fixture.competition}
          </p>
          <FixtureBadge label="COMING SOON" color="var(--chalk-dim)" />
        </div>
        <p
          className="display"
          style={{ fontSize: 18, margin: "6px 0", color: "var(--chalk-dim)" }}
        >
          {fixture.homeTeam} <span style={{ color: "var(--chalk-dim)" }}>v</span>{" "}
          {fixture.awayTeam}
        </p>
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: "0.08em",
            color: "var(--chalk-dim)",
          }}
        >
          {matchDateLabel(fixture.kickoffAt)}
        </p>
      </div>
    );
  }

  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={() => onSelect?.(fixture.id)}
      className="card"
      style={{
        textAlign: "left",
        borderColor: selected ? "var(--amber)" : undefined,
        background: selected ? "var(--pitch-3)" : undefined,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <p className="eyebrow" style={{ flex: 1 }}>
          {fixture.competition}
        </p>
        {fixture.kind === "replay" && (
          <FixtureBadge label="REPLAY" color="var(--grass)" />
        )}
      </div>
      <p
        className="display"
        style={{ fontSize: 18, margin: "6px 0", color: "var(--chalk)" }}
      >
        {fixture.homeTeam} <span style={{ color: "var(--amber)" }}>v</span>{" "}
        {fixture.awayTeam}
      </p>
      <p className="muted">Kicks off {kickoffLabel(fixture.kickoffAt)}</p>
    </motion.button>
  );
}

export default function CreateRoomPage() {
  const router = useRouter();
  const { profile, ready } = useProfile();
  const { wallet } = useAppWallet();

  const [step, setStep] = useState(0);
  const [fixtures, setFixtures] = useState<Fixture[] | null>(null);
  const [fixtureId, setFixtureId] = useState<string | null>(null);
  const [teamA, setTeamA] = useState<TeamSide>("home");
  const [wagerType, setWagerType] = useState<WagerType>("money");
  const [stakeUsd, setStakeUsd] = useState(10);
  const [payoutMode, setPayoutMode] = useState<PayoutMode>("winner_takes_all");
  const [forfeitPick, setForfeitPick] = useState<string>(DEFAULT_FORFEITS[0]);
  const [customForfeit, setCustomForfeit] = useState("");
  const [usingCustom, setUsingCustom] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && !profile) router.replace("/");
  }, [ready, profile, router]);

  useEffect(() => {
    listFixtures()
      .then((res) => setFixtures(res.fixtures))
      .catch((err: Error) => setError(err.message));
  }, []);

  const fixture = useMemo(
    () => fixtures?.find((f) => f.id === fixtureId) ?? null,
    [fixtures, fixtureId],
  );

  if (!ready || !profile) return null;

  const forfeitText = usingCustom ? customForfeit.trim() : forfeitPick;
  const stakesOk =
    wagerType === "money" ? true : forfeitText.length > 0;

  const liveFixtures = fixtures?.filter((f) => f.kind === "live") ?? [];
  const replayFixtures = fixtures?.filter((f) => f.kind === "replay") ?? [];
  const upcomingFixtures = fixtures?.filter((f) => f.kind === "upcoming") ?? [];
  const hasPlayable = liveFixtures.length + replayFixtures.length > 0;

  async function submit() {
    if (!profile || !fixtureId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const bundle = await createRoom({
        userId: profile.userId,
        displayName: profile.displayName,
        mascotId: profile.mascotId,
        fixtureId,
        teamA,
        wagerType,
        stakeUsd: wagerType === "money" ? stakeUsd : 0,
        payoutMode,
        forfeitText: wagerType === "forfeit" ? forfeitText : null,
        walletAddress: profile.walletAddress,
      });

      // Money rooms open a pool and take the creator's stake before the room is
      // shown, so the pot is live from the first player.
      if (wagerType === "money") {
        const creator = bundle.members[0];
        const deposit = await createPoolAndDeposit(bundle.room, wallet);
        await setRoomPool(bundle.room.code, {
          memberId: creator.id,
          poolAddress: deposit.poolAddress,
          walletAddress: profile.walletAddress,
        });
      }

      router.push(`/room/${bundle.room.code}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const steps = ["The match", "Your team", "The stakes"];

  return (
    <main style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 8 }}>
        <button
          className="btn btn-ghost btn-small"
          onClick={() => (step === 0 ? router.push("/lobby") : setStep(step - 1))}
        >
          Back
        </button>
        <div style={{ flex: 1 }}>
          <p className="eyebrow">Step {step + 1} of 3</p>
          <h1 style={{ fontSize: 22 }}>{steps[step]}</h1>
        </div>
      </header>

      {/* step progress bar */}
      <div style={{ display: "flex", gap: 6 }}>
        {steps.map((label, i) => (
          <motion.div
            key={label}
            animate={{
              background: i <= step ? "var(--amber)" : "var(--pitch-3)",
            }}
            style={{ flex: 1, height: 6, borderRadius: 3 }}
          />
        ))}
      </div>

      {error && <p className="error-line">{error}</p>}

      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.14, ease: [0.23, 1, 0.32, 1] }}
          style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}
        >
          {step === 0 && (
            <>
              {!fixtures && !error && (
                <div style={{ display: "flex", justifyContent: "center", paddingTop: 16 }}>
                  <DribbleLoader size="page" label="Loading fixtures…" />
                </div>
              )}
              {fixtures && !hasPlayable && (
                <p className="muted">No matches to play yet. Seed some and come back.</p>
              )}
              {liveFixtures.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <p className="eyebrow">Live</p>
                  {liveFixtures.map((f) => (
                    <FixtureCard
                      key={f.id}
                      fixture={f}
                      selected={fixtureId === f.id}
                      onSelect={setFixtureId}
                    />
                  ))}
                </div>
              )}
              {replayFixtures.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <p className="eyebrow">Replays</p>
                  {replayFixtures.map((f) => (
                    <FixtureCard
                      key={f.id}
                      fixture={f}
                      selected={fixtureId === f.id}
                      onSelect={setFixtureId}
                    />
                  ))}
                </div>
              )}
              {upcomingFixtures.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <p className="eyebrow">Coming soon</p>
                  {upcomingFixtures.map((f) => (
                    <FixtureCard key={f.id} fixture={f} />
                  ))}
                </div>
              )}
            </>
          )}

          {step === 1 && fixture && (
            <>
              <p className="muted">
                Your team is the star of the 3 point question: do they win it?
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {(["home", "away"] as TeamSide[]).map((side) => {
                  const on = teamA === side;
                  const label = side === "home" ? fixture.homeTeam : fixture.awayTeam;
                  return (
                    <motion.button
                      key={side}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setTeamA(side)}
                      className="card"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        borderColor: on ? "var(--grass)" : undefined,
                        background: on ? "var(--pitch-3)" : undefined,
                      }}
                    >
                      <span
                        className="display"
                        style={{
                          fontSize: 22,
                          color: on ? "var(--grass)" : "var(--chalk)",
                        }}
                      >
                        {label}
                      </span>
                      <span className="muted" style={{ marginLeft: "auto", fontSize: 12 }}>
                        {side === "home" ? "home" : "away"}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="pill-row">
                <button
                  className={`pill ${wagerType === "money" ? "on" : ""}`}
                  onClick={() => setWagerType("money")}
                >
                  Money pot
                </button>
                <button
                  className={`pill ${wagerType === "forfeit" ? "on" : ""}`}
                  onClick={() => setWagerType("forfeit")}
                >
                  Forfeit
                </button>
              </div>

              {wagerType === "money" ? (
                <>
                  <p className="eyebrow" style={{ marginTop: 8 }}>
                    Stake per player
                  </p>
                  <StakeRoller value={stakeUsd} onChange={setStakeUsd} />
                  <p className="eyebrow" style={{ marginTop: 8 }}>
                    How the pot splits
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {(Object.keys(PAYOUT_LABELS) as PayoutMode[]).map((mode) => (
                      <button
                        key={mode}
                        className={`pill ${payoutMode === mode ? "on" : ""}`}
                        onClick={() => setPayoutMode(mode)}
                        style={{ padding: "14px 10px" }}
                      >
                        {PAYOUT_LABELS[mode]}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p className="eyebrow" style={{ marginTop: 8 }}>
                    What the loser owes
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {DEFAULT_FORFEITS.map((line) => {
                      const on = !usingCustom && forfeitPick === line;
                      return (
                        <button
                          key={line}
                          className={`pill ${on ? "on" : ""}`}
                          onClick={() => {
                            setUsingCustom(false);
                            setForfeitPick(line);
                          }}
                          style={{ padding: "14px 10px", textAlign: "left" }}
                        >
                          {line}
                        </button>
                      );
                    })}
                    <button
                      className={`pill ${usingCustom ? "on" : ""}`}
                      onClick={() => setUsingCustom(true)}
                      style={{ padding: "14px 10px", textAlign: "left" }}
                    >
                      Write your own…
                    </button>
                    {usingCustom && (
                      <motion.input
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="field"
                        value={customForfeit}
                        onChange={(e) => setCustomForfeit(e.target.value)}
                        placeholder="Loser sings at karaoke night"
                        maxLength={120}
                      />
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </motion.div>
      </AnimatePresence>

      <div style={{ marginTop: "auto", paddingTop: 8 }}>
        {step < 2 ? (
          <button
            className="btn"
            disabled={step === 0 ? !fixtureId : false}
            onClick={() => setStep(step + 1)}
          >
            Next
          </button>
        ) : (
          <button className="btn" disabled={!stakesOk || busy} onClick={submit}>
            {busy ? (
              <>
                <DribbleLoader size="inline" /> Opening the room…
              </>
            ) : (
              "Open the room"
            )}
          </button>
        )}
      </div>
    </main>
  );
}
