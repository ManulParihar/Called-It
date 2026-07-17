"use client";

// The join screen a shared link lands on. Shows the match, the stakes and the
// crew already inside, then one tap to join.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { getRoom, joinRoom, setRoomPool } from "@/lib/api";
import type { RoomBundle } from "@/lib/types";
import { potCents } from "@/lib/live";
import { MascotAvatar } from "@/components/MascotAvatar";
import { useProfile } from "@/hooks/useProfile";
import { useAppWallet } from "@/lib/wallet/WalletProvider";
import { depositToPool } from "@/lib/wallet/deposit";

export default function JoinPage({ params }: { params: { code: string } }) {
  const code = decodeURIComponent(params.code).toUpperCase();
  const router = useRouter();
  const { profile, ready } = useProfile();
  const { wallet } = useAppWallet();
  const [bundle, setBundle] = useState<RoomBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // No profile yet: send them to pick a fighter first. The room code survives
  // in the join link they can reopen; keep it simple for now.
  useEffect(() => {
    if (ready && !profile) router.replace("/");
  }, [ready, profile, router]);

  useEffect(() => {
    getRoom(code)
      .then(setBundle)
      .catch((err: Error) => setError(err.message));
  }, [code]);

  // Already in this room? Go straight through.
  useEffect(() => {
    if (!bundle || !profile) return;
    if (bundle.members.some((m) => m.userId === profile.userId)) {
      router.replace(`/room/${code}`);
    }
  }, [bundle, profile, code, router]);

  if (!ready || !profile) return null;

  async function join() {
    if (!profile || busy) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await joinRoom(code, {
        userId: profile.userId,
        displayName: profile.displayName,
        mascotId: profile.mascotId,
        walletAddress: profile.walletAddress,
      });

      // Money rooms take the stake before letting the player in, then record the
      // deposit so the pot and the leaderboard know they are covered.
      if (updated.room.wagerType === "money") {
        const me = updated.members.find((m) => m.userId === profile.userId);
        if (me) {
          await depositToPool(updated.room, wallet);
          await setRoomPool(code, {
            memberId: me.id,
            walletAddress: profile.walletAddress,
          });
        }
      }

      router.push(`/room/${code}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const room = bundle?.room;
  const pot = bundle ? potCents(bundle) : 0;
  const joinable = room?.status === "open";

  return (
    <main style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
      <header style={{ textAlign: "center", paddingTop: 20 }}>
        <p className="eyebrow">You are invited</p>
        <p className="room-code">{code}</p>
      </header>

      {error && <p className="error-line">{error}</p>}
      {!bundle && !error && (
        <p className="muted" style={{ textAlign: "center" }}>
          Finding the room…
        </p>
      )}

      {bundle && room && (
        <>
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card poster-stripes"
            style={{ textAlign: "center", padding: "22px 16px" }}
          >
            <p className="eyebrow">{room.fixture.competition}</p>
            <h1 style={{ fontSize: 24, margin: "8px 0" }}>
              {room.fixture.homeTeam}{" "}
              <span style={{ color: "var(--tangerine)" }}>vs</span>{" "}
              {room.fixture.awayTeam}
            </h1>
            {room.wagerType === "money" ? (
              <p style={{ fontWeight: 700 }}>
                <span style={{ color: "var(--lime)" }}>
                  ${room.stakeUsd} a head
                </span>{" "}
                <span className="muted">
                  · pot so far ${(pot / 100).toFixed(0)}
                </span>
              </p>
            ) : (
              <p style={{ fontWeight: 700, color: "var(--tangerine)" }}>
                Forfeit: {room.forfeitText}
              </p>
            )}
          </motion.section>

          <section>
            <p className="eyebrow" style={{ marginBottom: 8 }}>
              Already in ({bundle.members.length})
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {bundle.members.map((m, i) => (
                <motion.div
                  key={m.id}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.06 * i, type: "spring", stiffness: 300, damping: 18 }}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 2,
                    width: 64,
                  }}
                >
                  <MascotAvatar mascotId={m.mascotId} size={52} />
                  <span
                    className="muted"
                    style={{
                      fontSize: 10,
                      maxWidth: 64,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {m.displayName}
                  </span>
                </motion.div>
              ))}
            </div>
          </section>

          <div style={{ marginTop: "auto" }}>
            {joinable ? (
              <button className="btn btn-lime" disabled={busy} onClick={join}>
                {busy ? "Joining…" : "Count me in"}
              </button>
            ) : (
              <p className="error-line">
                This room is {room.status}. Answers are locked at kickoff.
              </p>
            )}
          </div>
        </>
      )}
    </main>
  );
}
