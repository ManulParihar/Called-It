// Pulls live and upcoming fixtures from the TxLINE schedule so the create screen
// can show real matches: the ones playing now under "Live" and the ones still to
// come under "Upcoming".
//
// This is best effort and never throws. If there is no API token, or the feed
// is unreachable, it returns empty lists and the picker just falls back to the
// replay fixtures. That keeps the demo working in a tunnel with no feed access.

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

// How long after kickoff a match is still treated as "live". Comfortably covers
// 90 minutes plus stoppage, half time and a little extra time.
const LIVE_WINDOW_MS = 2.5 * 60 * 60 * 1000;

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

export interface TxlineFixtures {
  live: Fixture[];
  upcoming: Fixture[];
}

// Live and upcoming World Cup fixtures from the TxLINE schedule. Live matches
// are the ones that kicked off within the last few hours (most recent first);
// upcoming are still to come (soonest first). Both lists are empty on any
// failure, so a missing token or an outage never breaks the picker.
export async function getTxlineFixtures(upcomingLimit = 6): Promise<TxlineFixtures> {
  let store: CredentialStore;
  try {
    store = new CredentialStore();
  } catch {
    // No API token configured. Nothing to show, and that is fine.
    return { live: [], upcoming: [] };
  }

  try {
    const rows = await fetchSnapshot(store);
    const now = Date.now();
    const fixtures = rows
      .filter(isWorldCup)
      .map(toFixture)
      .filter((f): f is Fixture => f !== null);

    const live = fixtures
      .filter((f) => {
        const kickoff = new Date(f.kickoffAt).getTime();
        return kickoff <= now && kickoff > now - LIVE_WINDOW_MS;
      })
      .map((f) => ({ ...f, kind: "live" as const }))
      .sort((a, b) => new Date(b.kickoffAt).getTime() - new Date(a.kickoffAt).getTime());

    const upcoming = fixtures
      .filter((f) => new Date(f.kickoffAt).getTime() > now)
      .sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime())
      .slice(0, upcomingLimit);

    return { live, upcoming };
  } catch {
    return { live: [], upcoming: [] };
  }
}
