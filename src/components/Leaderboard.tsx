"use client";

// The standings used on the live and full time screens. Rows spring to their
// new spot when the order changes mid match, and the bottom name is put on
// the hook while the match is still running.

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
                ? "rgba(69,178,107,0.12)"
                : loser && final
                  ? "rgba(240,89,74,0.12)"
                  : "var(--pitch-2)",
              border: `1px solid ${
                winner
                  ? "rgba(69,178,107,0.55)"
                  : loser && final
                    ? "rgba(240,89,74,0.55)"
                    : me
                      ? "rgba(242,244,236,0.4)"
                      : "var(--chalk-line)"
              }`,
            }}
          >
            <span
              className="display"
              style={{
                width: 22,
                fontSize: 17,
                color:
                  entry.rank === 1
                    ? "var(--amber)"
                    : loser && final
                      ? "var(--stamp-bright)"
                      : "var(--chalk-dim)",
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
                minWidth: 0,
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
            {/* stakes made visible: who's on the hook while it's live */}
            {loser && !final && entries.length > 1 && (
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontWeight: 700,
                  fontSize: 9,
                  letterSpacing: "0.08em",
                  color: "var(--stamp-bright)",
                  border: "1px solid rgba(240,89,74,0.5)",
                  borderRadius: 3,
                  padding: "2px 5px",
                  whiteSpace: "nowrap",
                }}
              >
                ON THE HOOK
              </span>
            )}
            {payout > 0 && (
              <span
                style={{
                  color: "var(--amber)",
                  fontFamily: "var(--font-mono)",
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                ${(payout / 100).toFixed(2)}
              </span>
            )}
            <span
              className="display"
              style={{
                fontSize: 18,
                color: winner ? "var(--grass)" : "var(--chalk)",
                minWidth: 34,
                textAlign: "right",
              }}
            >
              {entry.points}
              <span style={{ fontSize: 10, color: "var(--chalk-dim)" }}> pt</span>
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}
