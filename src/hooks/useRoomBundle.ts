"use client";

// Everything a room screen needs to stay current: the bundle from the API,
// the running match state, and the stream of match events.
//
// Realtime does the heavy lifting. When a members, questions, answers or rooms
// row changes we refetch the bundle. Match state rows carry the whole state as
// json, so those update straight from the payload. If realtime is not
// configured the hook quietly falls back to polling, so the game still moves.

import { useCallback, useEffect, useRef, useState } from "react";
import { getRoom } from "@/lib/api";
import { subscribeRoom } from "@/lib/realtime";
import type { MatchEventRow, RoomBundle } from "@/lib/types";
import { initialMatchState, type MatchState } from "@/lib/match";

// The shape of a match_events row, whether realtime delivered it or it arrived
// backfilled on the bundle. Same row either way.
export type LiveEvent = MatchEventRow;

const POLL_MS = 4000;

export function useRoomBundle(code: string): {
  bundle: RoomBundle | null;
  matchState: MatchState | null;
  events: LiveEvent[];
  error: string | null;
  refresh: () => void;
} {
  const [bundle, setBundle] = useState<RoomBundle | null>(null);
  const [matchState, setMatchState] = useState<MatchState | null>(null);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const seenEventIds = useRef<Set<number>>(new Set());

  const refresh = useCallback(() => {
    getRoom(code)
      .then((next) => {
        setBundle(next);
        setError(null);

        // Merge the bundle's events in beside anything realtime already gave
        // us, keyed on the same seen set so neither source duplicates the
        // other. Kept sorted by id: the ticker and the live screen both treat
        // this as append only.
        const fresh = (next.events ?? []).filter(
          (row) => !seenEventIds.current.has(row.id),
        );
        if (fresh.length > 0) {
          for (const row of fresh) seenEventIds.current.add(row.id);
          setEvents((prev) => [...prev, ...fresh].sort((a, b) => a.id - b.id));
        }

        // A poll with no state row yet must not wipe a state realtime has
        // already delivered.
        if (next.matchState) setMatchState(next.matchState);
      })
      .catch((err: Error) => setError(err.message));
  }, [code]);

  // First load.
  useEffect(() => {
    refresh();
  }, [refresh]);

  const roomId = bundle?.room.id ?? null;
  const fixtureId = bundle?.room.fixture.id ?? null;

  // Live updates once we know the room and fixture ids.
  useEffect(() => {
    if (!roomId || !fixtureId) return;

    setMatchState((prev) => prev ?? initialMatchState(fixtureId));

    let refetchTimer: ReturnType<typeof setTimeout> | null = null;
    const queueRefetch = () => {
      // Small debounce so a burst of row changes causes one refetch.
      if (refetchTimer) clearTimeout(refetchTimer);
      refetchTimer = setTimeout(refresh, 150);
    };

    let unsubscribe: (() => void) | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    try {
      unsubscribe = subscribeRoom({
        roomId,
        fixtureId,
        onChange: (change, row) => {
          if (change === "match_state") {
            const state = row.state as MatchState | undefined;
            if (state) setMatchState(state);
            return;
          }
          if (change === "match_events") {
            const id = row.id as number;
            if (seenEventIds.current.has(id)) return;
            seenEventIds.current.add(id);
            setEvents((prev) => [
              ...prev,
              {
                id,
                kind: (row.kind as string) ?? "",
                team: (row.team as "home" | "away" | null) ?? null,
                minute: (row.minute as number | null) ?? null,
                phase: (row.phase as string | null) ?? null,
              },
            ]);
            return;
          }
          queueRefetch();
        },
      });
    } catch {
      // No realtime config on this device. Poll instead so nothing breaks.
      pollTimer = setInterval(refresh, POLL_MS);
    }

    return () => {
      if (refetchTimer) clearTimeout(refetchTimer);
      if (pollTimer) clearInterval(pollTimer);
      unsubscribe?.();
    };
  }, [roomId, fixtureId, refresh]);

  return { bundle, matchState, events, error, refresh };
}
