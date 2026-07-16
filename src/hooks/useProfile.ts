"use client";

// The device identity. There is no auth yet, so each phone gets a random
// userId kept in local storage, plus the name and mascot the player picked.

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "calledit.profile";

export interface Profile {
  userId: string;
  displayName: string;
  mascotId: string;
}

function randomId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `u-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Profile;
    if (!parsed.userId || !parsed.displayName || !parsed.mascotId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveProfile(displayName: string, mascotId: string): Profile {
  const existing = loadProfile();
  const profile: Profile = {
    userId: existing?.userId ?? randomId(),
    displayName,
    mascotId,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  return profile;
}

// Returns the stored profile once the browser is ready. `ready` goes true
// after the first read so screens can wait before redirecting.
export function useProfile(): {
  profile: Profile | null;
  ready: boolean;
  save: (displayName: string, mascotId: string) => Profile;
} {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setProfile(loadProfile());
    setReady(true);
  }, []);

  const save = useCallback((displayName: string, mascotId: string) => {
    const next = saveProfile(displayName, mascotId);
    setProfile(next);
    return next;
  }, []);

  return { profile, ready, save };
}
