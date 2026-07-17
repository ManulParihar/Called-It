"use client";

// One page for the whole life of a room. It watches the room status and shows
// the right act: make your calls, wait for kickoff, live match, full time.

import { useEffect } from "react";
import type { ReactNode } from "react";
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
import { DevBar } from "@/components/DevBar";

const DEV_TOOLS = process.env.NODE_ENV !== "production";

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

  // The right act for where the room is. Kept in a local function so its early
  // returns still narrow the types, while the testing bar mounts once below.
  function act(): ReactNode {
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
            line="Match is off. Stakes go back to every pocket. Nobody wins, nobody pays."
          />
          <div>
            <div
              className="slip"
              style={{ textAlign: "center", padding: "16px", position: "relative" }}
            >
              <p className="display" style={{ fontSize: 20, color: "var(--ink)" }}>
                Match voided
              </p>
              <p style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: "var(--ink-soft)" }}>
                {bundle.room.wagerType === "money"
                  ? "ALL STAKES REFUNDED"
                  : "THE FORFEIT IS CANCELLED"}
              </p>
              <span
                className="stamp"
                aria-hidden
                style={{
                  position: "absolute",
                  right: 12,
                  top: 10,
                  fontSize: 16,
                  color: "var(--stamp)",
                }}
              >
                Void
              </span>
            </div>
            <div className="slip-tear" />
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

  return (
    <>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          paddingBottom: DEV_TOOLS ? 76 : 0,
        }}
      >
        {act()}
      </div>
      <DevBar code={code} onChanged={refresh} />
    </>
  );
}
