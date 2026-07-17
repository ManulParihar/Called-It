// Live updates for a room.
//
// The screens call subscribeRoom with a room id and a fixture id. Whenever a row
// changes (a player joins, a question resolves, the match state moves, a new
// event lands, or the room status changes) the callback fires and the screen can
// refetch or update. Returns a function that stops listening.

import type { RealtimeChannel } from "@supabase/supabase-js";
import { browserDb } from "./supabase-browser";

export type RoomChange =
  | "members"
  | "questions"
  | "answers"
  | "rooms"
  | "match_state"
  | "match_events";

export interface SubscribeOptions {
  roomId: string;
  fixtureId: string;
  onChange: (change: RoomChange, row: Record<string, unknown>) => void;
}

export function subscribeRoom(options: SubscribeOptions): () => void {
  // In local mode there is no realtime server. Throwing here makes the room hook
  // fall back to polling, which is enough to watch the game move.
  if (process.env.NEXT_PUBLIC_LOCAL_DB === "1") {
    throw new Error("Realtime is off in local mode");
  }

  const db = browserDb();
  const { roomId, fixtureId, onChange } = options;

  const roomFilter = `room_id=eq.${roomId}`;
  const fixtureFilter = `fixture_id=eq.${fixtureId}`;

  const channel: RealtimeChannel = db
    .channel(`room:${roomId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "members", filter: roomFilter },
      (payload) => onChange("members", payload.new as Record<string, unknown>),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "questions", filter: roomFilter },
      (payload) => onChange("questions", payload.new as Record<string, unknown>),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "answers", filter: roomFilter },
      (payload) => onChange("answers", payload.new as Record<string, unknown>),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
      (payload) => onChange("rooms", payload.new as Record<string, unknown>),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "match_state", filter: fixtureFilter },
      (payload) => onChange("match_state", payload.new as Record<string, unknown>),
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "match_events", filter: fixtureFilter },
      (payload) => onChange("match_events", payload.new as Record<string, unknown>),
    )
    .subscribe();

  return () => {
    db.removeChannel(channel);
  };
}
