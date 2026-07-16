"use client";

// The standings table used on the live and full time screens. Rows slide to
// their new spot when the order changes mid match.

import { motion } from "framer-motion";
import type { LeaderboardEntry } from "@/lib/types";
import { MascotAvatar } from "./MascotAvatar";

export function Leaderboard({
  entries,
  payoutByMember,
  highlightMemberId,
  final = false,
}: {
  entries: LeaderboardEntry[];
  // memberId -> amount in cents, for money rooms
  payoutByMember?: Map<string, number>;
  highlightMemberId?: string;
  final?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {entries.map((entry) => {
        const me = entry.memberId === highlightMemberId;
        const payout = payoutByMember?.get(entry.memberId) ?? 0;
        const winner = entry.isWinner;
        const loser = entry.isLoser;
        return (
          <motion.div
            key={entry.memberId}
            layout
            transition={{ type: "spring", stiffness: 350, damping: 28 }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 12px",
              borderRadius: "var(--radius-sm)",
              background: winner
                ? "rgba(200,245,39,0.1)"
                : loser && final
                  ? "rgba(255,66,66,0.12)"
                  : "var(--night-2)",
              border: `2px solid ${
                winner
                  ? "rgba(200,245,39,0.5)"
                  : loser && final
                    ? "rgba(255,66,66,0.5)"
                    : me
                      ? "rgba(255,243,226,0.3)"
                      : "rgba(255,243,226,0.06)"
              }`,
            }}
          >
            <span
              className="display"
              style={{
                width: 24,
                fontSize: 16,
                color:
                  entry.rank === 1
                    ? "var(--gold)"
                    : loser && final
                      ? "var(--danger)"
                      : "var(--cream-dim)",
              }}
            >
              {entry.rank}
            </span>
            <MascotAvatar mascotId={entry.mascotId} size={38} />
            <span
              style={{
                fontWeight: 700,
                fontSize: 14,
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {entry.displayName}
              {me && (
                <span className="muted" style={{ fontSize: 11 }}>
                  {" "}
                  (you)
                </span>
              )}
            </span>
            {payout > 0 && (
              <span
                style={{ color: "var(--lime)", fontWeight: 800, fontSize: 13 }}
              >
                ${(payout / 100).toFixed(2)}
              </span>
            )}
            <span
              className="display"
              style={{
                fontSize: 18,
                color: winner ? "var(--lime)" : "var(--cream)",
                minWidth: 34,
                textAlign: "right",
              }}
            >
              {entry.points}
              <span style={{ fontSize: 10, color: "var(--cream-dim)" }}> pt</span>
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}
