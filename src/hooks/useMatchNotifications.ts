"use client";

// A tiny queue of in-app "notification" banners for the loud match moments.
// This is not a real push notification — there is no service worker and nothing
// reaches the lock screen. It is an in-app overlay styled like a phone
// notification, so the moment reads the way a native alert would while you have
// the app open. The queue lives at the room level so a banner (full time in
// particular) survives the live-screen giving way to the full-time screen.

import { useCallback, useState } from "react";

export type NotificationTone = "goal" | "alert" | "info";

export interface MatchNotification {
  id: string; // stable per moment (the event id, or "ft") so it enqueues once
  emoji: string;
  title: string;
  body: string;
  tone: NotificationTone;
}

export function useMatchNotifications() {
  const [items, setItems] = useState<MatchNotification[]>([]);

  const notify = useCallback((next: MatchNotification) => {
    setItems((cur) => (cur.some((n) => n.id === next.id) ? cur : [...cur, next]));
  }, []);

  const dismiss = useCallback((id: string) => {
    setItems((cur) => cur.filter((n) => n.id !== id));
  }, []);

  return { items, notify, dismiss };
}
