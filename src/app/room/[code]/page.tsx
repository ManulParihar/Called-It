"use client";

// One page for the whole life of a room. It watches the room status and shows
// the right act: make your calls, wait for kickoff, live match, full time.

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useProfile } from "@/hooks/useProfile";
import { useRoomBundle } from "@/hooks/useRoomBundle";
import { hasAnswered } from "@/lib/live";
import { PredictScreen } from "@/components/PredictScreen";
import { WaitingScreen } from "@/components/WaitingScreen";
import { LiveScreen } from "@/components/LiveScreen";
import { FullTimeScreen } from "@/components/FullTimeScreen";
import { Referee } from "@/components/Referee";

export default function RoomPage({ params }: { params: { code: string } }) {
  const code = decodeURIComponent(params.code).toUpperCase();
  const router = useRouter();
  const { profile, ready } = useProfile();
  const { bundle, matchState, events, error, refresh } = useRoomBundle(code);

  useEffect(() => {
    if (ready && !profile) router.replace("/");
  }, [ready, profile, router]);

  const me =
    bundle && profile
      ? bundle.members.find((m) => m.userId === profile.userId) ?? null
      : null;

  // Not in this room yet: the join screen shows the stakes first.
  useEffect(() => {
    if (bundle && profile && !me) {
      router.replace(`/join/${code}`);
    }
  }, [bundle, profile, me, code, router]);

  if (!ready || !profile) return null;

  if (error && !bundle) {
    return (
      <main style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1, justifyContent: "center" }}>
        <p className="error-line">{error}</p>
        <Link href="/lobby" className="btn btn-ghost" style={{ textDecoration: "none" }}>
          Back to the lobby
        </Link>
      </main>
    );
  }

  if (!bundle || !me) {
    return (
      <main style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center" }}>
        <p className="muted">Opening the room…</p>
      </main>
    );
  }

  const status = bundle.room.status;

  if (status === "cancelled") {
    return (
      <main style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1, justifyContent: "center" }}>
        <Referee
          mood="neutral"
          line="Match is off. Stakes go back where they came from. Nobody wins, nobody dances."
        />
        <div className="card" style={{ textAlign: "center" }}>
          <p className="display" style={{ fontSize: 20 }}>
            Match voided
          </p>
          <p className="muted" style={{ marginTop: 6 }}>
            {bundle.room.wagerType === "money"
              ? "All stakes are refunded."
              : "The forfeit is cancelled."}
          </p>
        </div>
        <Link href="/lobby" className="btn" style={{ textDecoration: "none" }}>
          Back to the lobby
        </Link>
      </main>
    );
  }

  if (status === "settled") {
    return <FullTimeScreen bundle={bundle} matchState={matchState} me={me} />;
  }

  if (status === "locked" || status === "live") {
    return <LiveScreen bundle={bundle} matchState={matchState} events={events} me={me} />;
  }

  // Room is open: answer first, then wait with the crew.
  if (!hasAnswered(bundle, me.id)) {
    return <PredictScreen bundle={bundle} me={me} onSubmitted={refresh} />;
  }

  return <WaitingScreen bundle={bundle} me={me} />;
}
