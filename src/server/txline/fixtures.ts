// Pulls upcoming fixtures from the TxLINE schedule so the create screen can show
// real matches as "coming soon".
//
// This is best effort and never throws. If there is no API token, or the feed
// is unreachable, it returns an empty list and the picker just falls back to the
// seeded and replay fixtures. That keeps the demo working in a tunnel with no
// feed access.

import type { Fixture } from "../../lib/types";
import { CredentialStore, baseUrl } from "./auth";

// One fixture row as the TxLINE schedule returns it. Only the fields we use are
// listed; the feed sends more.
interface FeedFixture {
  FixtureId: number | string;
  Competition?: string;
  CompetitionId?: number;
  StartTime?: number | string;
  Participant1?: string;
  Participant2?: string;
  Participant1IsHome?: boolean;
}

const SNAPSHOT_TIMEOUT_MS = 4000;

// Turns the feed's start time (epoch seconds, epoch millis, or an ISO string)
// into an ISO string. Returns null when it cannot be read.
function toIso(value: number | string | undefined): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "number") {
    const ms = value > 1e12 ? value : value * 1000;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toFixture(row: FeedFixture): Fixture | null {
  const kickoffAt = toIso(row.StartTime);
  if (!kickoffAt || !row.Participant1 || !row.Participant2) return null;
  const p1Home = row.Participant1IsHome !== false;
  return {
    id: `tx-${row.FixtureId}`,
    competition: row.Competition ?? "Football",
    homeTeam: p1Home ? row.Participant1 : row.Participant2,
    awayTeam: p1Home ? row.Participant2 : row.Participant1,
    kickoffAt,
    kind: "upcoming",
    txFixtureId: String(row.FixtureId),
  };
}

function isWorldCup(row: FeedFixture): boolean {
  return (row.Competition ?? "").toLowerCase().includes("world cup");
}

async function fetchSnapshot(store: CredentialStore): Promise<FeedFixture[]> {
  const startEpochDay = Math.floor(Date.now() / 86_400_000);
  const url = `${baseUrl()}/api/fixtures/snapshot?startEpochDay=${startEpochDay}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SNAPSHOT_TIMEOUT_MS);
  try {
    let creds = await store.current();
    let res = await fetch(url, {
      headers: { ...store.authHeaders(creds), Accept: "application/json" },
      signal: controller.signal,
    });
    if (res.status === 401) {
      creds = await store.refresh();
      res = await fetch(url, {
        headers: { ...store.authHeaders(creds), Accept: "application/json" },
        signal: controller.signal,
      });
    }
    if (!res.ok) return [];
    const body = (await res.json()) as FeedFixture[] | { fixtures?: FeedFixture[] };
    return Array.isArray(body) ? body : (body.fixtures ?? []);
  } finally {
    clearTimeout(timer);
  }
}

// Upcoming World Cup fixtures, soonest first. Empty on any failure.
export async function getUpcomingFromTxline(limit = 6): Promise<Fixture[]> {
  let store: CredentialStore;
  try {
    store = new CredentialStore();
  } catch {
    // No API token configured. Nothing to show, and that is fine.
    return [];
  }

  try {
    const rows = await fetchSnapshot(store);
    const now = Date.now();
    return rows
      .filter(isWorldCup)
      .map(toFixture)
      .filter((f): f is Fixture => f !== null && new Date(f.kickoffAt).getTime() > now)
      .sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime())
      .slice(0, limit);
  } catch {
    return [];
  }
}
