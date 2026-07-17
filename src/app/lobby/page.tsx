"use client";

// The lobby. Start a new room or join one with a code.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { MASCOTS } from "@/lib/mascots";
import { MascotAvatar } from "@/components/MascotAvatar";
import { useProfile } from "@/hooks/useProfile";

const EASE = [0.23, 1, 0.32, 1] as const;

export default function LobbyPage() {
  const router = useRouter();
  const { profile, ready } = useProfile();
  const [code, setCode] = useState("");

  useEffect(() => {
    if (ready && !profile) router.replace("/");
  }, [ready, profile, router]);

  if (!ready || !profile) return null;

  const club = MASCOTS.find((m) => m.id === profile.mascotId);
  const cleanCode = code.trim().toUpperCase();

  function goJoin() {
    if (!cleanCode) return;
    router.push(`/join/${encodeURIComponent(cleanCode)}`);
  }

  return (
    <main style={{ display: "flex", flexDirection: "column", gap: 18, flex: 1 }}>
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE }}
        style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 12 }}
      >
        <MascotAvatar mascotId={profile.mascotId} size={64} />
        <div style={{ flex: 1 }}>
          <p className="eyebrow">{club?.name ?? "In the stands"}</p>
          <h1 style={{ fontSize: 26, color: "var(--chalk)" }}>{profile.displayName}</h1>
        </div>
        <Link
          href="/#edit"
          className="muted"
          style={{ fontSize: 12, textDecoration: "underline", padding: 12 }}
        >
          switch
        </Link>
      </motion.header>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE, delay: 0.06 }}
        className="card"
        style={{ textAlign: "center", padding: "26px 16px" }}
      >
        <h2 style={{ fontSize: 22, marginBottom: 6 }}>
          Open a <span style={{ color: "var(--amber)" }}>room</span>
        </h2>
        <p className="muted" style={{ marginBottom: 16 }}>
          Pick the match, set the stakes, invite the crew.
        </p>
        <Link href="/create" className="btn" style={{ textDecoration: "none" }}>
          Create a room
        </Link>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE, delay: 0.12 }}
        className="card"
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
      >
        <h2 style={{ fontSize: 22, textAlign: "center" }}>
          Join your <span style={{ color: "var(--grass)" }}>crew</span>
        </h2>
        <input
          className="field"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && goJoin()}
          placeholder="ROOM CODE"
          maxLength={12}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-label="Room code"
          style={{
            textAlign: "center",
            fontFamily: "var(--font-mono)",
            fontWeight: 700,
            letterSpacing: "0.3em",
            fontSize: 20,
          }}
        />
        <button className="btn btn-ghost" disabled={!cleanCode} onClick={goJoin}>
          Find the room
        </button>
      </motion.section>

      <p
        className="muted"
        style={{ textAlign: "center", marginTop: "auto", fontSize: 12 }}
      >
        Got a link from a friend? Just open it, it lands you in their room.
      </p>
    </main>
  );
}
