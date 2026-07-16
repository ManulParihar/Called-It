"use client";

// The lobby. Start a new room or join one with a code.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { MascotAvatar } from "@/components/MascotAvatar";
import { useProfile } from "@/hooks/useProfile";

export default function LobbyPage() {
  const router = useRouter();
  const { profile, ready } = useProfile();
  const [code, setCode] = useState("");

  useEffect(() => {
    if (ready && !profile) router.replace("/");
  }, [ready, profile, router]);

  if (!ready || !profile) return null;

  const cleanCode = code.trim().toUpperCase();

  function goJoin() {
    if (!cleanCode) return;
    router.push(`/join/${encodeURIComponent(cleanCode)}`);
  }

  return (
    <main style={{ display: "flex", flexDirection: "column", gap: 20, flex: 1 }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          paddingTop: 12,
        }}
      >
        <motion.div
          className="floaty"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
        >
          <MascotAvatar mascotId={profile.mascotId} size={72} />
        </motion.div>
        <div style={{ flex: 1 }}>
          <p className="eyebrow">In the ring tonight</p>
          <h1 style={{ fontSize: 24, color: "var(--cream)" }}>{profile.displayName}</h1>
        </div>
        <Link
          href="/#edit"
          className="muted"
          style={{ fontSize: 12, textDecoration: "underline" }}
        >
          switch
        </Link>
      </header>

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card poster-stripes"
        style={{ textAlign: "center", padding: "28px 16px" }}
      >
        <h2 style={{ fontSize: 20, marginBottom: 6 }}>
          <span style={{ color: "var(--magenta)" }}>Start</span> a match room
        </h2>
        <p className="muted" style={{ marginBottom: 16 }}>
          Pick the fixture, set the stakes, invite the crew.
        </p>
        <Link href="/create" className="btn" style={{ textDecoration: "none" }}>
          Create a room
        </Link>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="card"
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
      >
        <h2 style={{ fontSize: 20, textAlign: "center" }}>
          <span style={{ color: "var(--lime)" }}>Join</span> your crew
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
          style={{
            textAlign: "center",
            fontFamily: "var(--font-display)",
            letterSpacing: "0.3em",
            fontSize: 20,
          }}
        />
        <button className="btn btn-lime" disabled={!cleanCode} onClick={goJoin}>
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
