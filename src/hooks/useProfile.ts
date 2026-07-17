"use client";

// The player identity. Each phone gets a stable userId kept in local storage,
// plus the name and mascot they picked and the Solana wallet address they signed
// in with. The wallet is what makes the money pot possible; forfeit rooms carry
// it too so the same sign in works for both.

import { useCallback, useEffect, useState } from "react";
import { clearLocalWallet } from "@/lib/wallet/useLocalWallet";

const STORAGE_KEY = "calledit.profile";

export interface Profile {
  userId: string;
  displayName: string;
  mascotId: string;
  walletAddress: string | null;
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
    const parsed = JSON.parse(raw) as Partial<Profile>;
    if (!parsed.userId || !parsed.displayName || !parsed.mascotId) return null;
    return {
      userId: parsed.userId,
      displayName: parsed.displayName,
      mascotId: parsed.mascotId,
      walletAddress: parsed.walletAddress ?? null,
    };
  } catch {
    return null;
  }
}

export function saveProfile(
  displayName: string,
  mascotId: string,
  walletAddress: string | null = null,
): Profile {
  const existing = loadProfile();
  const profile: Profile = {
    userId: existing?.userId ?? randomId(),
    displayName,
    mascotId,
    walletAddress: walletAddress ?? existing?.walletAddress ?? null,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  return profile;
}

// Forgets the stored identity so the next sign in mints a fresh userId, and the
// browser wallet with it, so a new tester deposits from a fresh wallet. Used by
// the testing tools to join a room as a different person from one browser.
export function clearProfile(): void {
  localStorage.removeItem(STORAGE_KEY);
  clearLocalWallet();
}

// Returns the stored profile once the browser is ready. `ready` goes true
// after the first read so screens can wait before redirecting.
export function useProfile(): {
  profile: Profile | null;
  ready: boolean;
  save: (displayName: string, mascotId: string, walletAddress?: string | null) => Profile;
  reset: () => void;
} {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setProfile(loadProfile());
    setReady(true);
  }, []);

  const save = useCallback(
    (displayName: string, mascotId: string, walletAddress: string | null = null) => {
      const next = saveProfile(displayName, mascotId, walletAddress);
      setProfile(next);
      return next;
    },
    [],
  );

  const reset = useCallback(() => {
    clearProfile();
    setProfile(null);
  }, []);

  return { profile, ready, save, reset };
}
