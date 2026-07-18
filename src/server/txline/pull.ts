// Finds recently finished World Cup matches on the TxLINE feed and folds each
// one into the JSON Lines timeline the replay tools understand.
//
// This is the shared core behind two callers: the pull:replays script, which
// writes the timelines to disk for local use, and the in app refresh button,
// which stores them on the fixture row so they work on a serverless host with a
// read only filesystem. Both get the same {meta, lines} pairs from here.

import { CredentialStore, baseUrl } from "./auth";
import { fetchHistorical, scoresToReplayLines } from "./history";
import type { ReplayLine } from "./replay";

const WANT = 5;
// A usable replay needs at least a kickoff, an end, and something in between.
const MIN_LINES = 4;

interface FeedFixture {
  FixtureId: number | string;
  Competition?: string;
  StartTime?: number | string;
  Participant1?: string;
  Participant2?: string;
  Participant1IsHome?: boolean;
}

export interface ReplayMeta {
  id: string;
  txFixtureId: string;
  competition: string;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: string;
}

export interface PulledReplay {
  meta: ReplayMeta;
  lines: ReplayLine[];
}

function toMs(value: number | string | undefined): number | undefined {
  if (typeof value === "number") return value > 1e12 ? value : value * 1000;
  if (typeof value === "string") {
    const t = new Date(value).getTime();
    return Number.isNaN(t) ? undefined : t;
  }
  return undefined;
}

async function fetchSnapshot(store: CredentialStore, startEpochDay: number): Promise<FeedFixture[]> {
  const url = `${baseUrl()}/api/fixtures/snapshot?startEpochDay=${startEpochDay}`;
  let creds = await store.current();
  let res = await fetch(url, {
    headers: { ...store.authHeaders(creds), Accept: "application/json" },
  });
  if (res.status === 401) {
    creds = await store.refresh();
    res = await fetch(url, {
      headers: { ...store.authHeaders(creds), Accept: "application/json" },
    });
  }
  if (!res.ok) throw new Error(`Fixtures snapshot failed with status ${res.status}`);
  const body = (await res.json()) as FeedFixture[] | { fixtures?: FeedFixture[] };
  return Array.isArray(body) ? body : (body.fixtures ?? []);
}

// Finished World Cup fixtures inside the window the historical endpoint serves:
// started more than six hours ago and less than two weeks ago.
async function findCandidates(
  store: CredentialStore,
  log: (message: string) => void,
): Promise<FeedFixture[]> {
  const day = 86_400_000;
  const today = Math.floor(Date.now() / day);
  const now = Date.now();
  const oldest = now - 14 * day;
  const newest = now - 6 * 60 * 60 * 1000;

  const byId = new Map<string, FeedFixture>();
  for (const offset of [14, 10, 7, 4, 2, 1]) {
    let rows: FeedFixture[] = [];
    try {
      rows = await fetchSnapshot(store, today - offset);
    } catch (err) {
      log(`  snapshot for day -${offset} failed: ${(err as Error).message}`);
      continue;
    }
    for (const row of rows) {
      const start = toMs(row.StartTime);
      const isWorldCup = (row.Competition ?? "").toLowerCase().includes("world cup");
      if (!isWorldCup || start === undefined) continue;
      if (start < oldest || start > newest) continue;
      byId.set(String(row.FixtureId), row);
    }
  }

  return [...byId.values()].sort(
    (a, b) => (toMs(b.StartTime) ?? 0) - (toMs(a.StartTime) ?? 0),
  );
}

function metaFor(row: FeedFixture): ReplayMeta {
  const p1Home = row.Participant1IsHome !== false;
  const kickoff = toMs(row.StartTime);
  return {
    id: `tx-${row.FixtureId}`,
    txFixtureId: String(row.FixtureId),
    competition: row.Competition ?? "World Cup",
    homeTeam: (p1Home ? row.Participant1 : row.Participant2) ?? "Home",
    awayTeam: (p1Home ? row.Participant2 : row.Participant1) ?? "Away",
    kickoffAt: new Date(kickoff ?? Date.now()).toISOString(),
  };
}

// Pulls up to `want` recently finished World Cup matches, returning the fixture
// metadata paired with its recorded timeline. Skips matches whose timeline is
// too thin to be worth replaying. Requires TXLINE_API_TOKEN; throws if it is
// not set, since without the feed there is nothing to pull.
export async function pullRecentReplays(
  options: { want?: number; log?: (message: string) => void } = {},
): Promise<PulledReplay[]> {
  const want = options.want ?? WANT;
  const log = options.log ?? (() => {});
  const store = new CredentialStore();

  log("Looking for recently finished World Cup matches...");
  const candidates = await findCandidates(store, log);
  log(`Found ${candidates.length} candidate fixtures in the historical window.`);

  const pulled: PulledReplay[] = [];
  for (const row of candidates) {
    if (pulled.length >= want) break;
    const meta = metaFor(row);
    try {
      const scores = await fetchHistorical(store, meta.txFixtureId);
      const lines = scoresToReplayLines(scores);
      if (lines.length < MIN_LINES) {
        log(`  ${meta.homeTeam} v ${meta.awayTeam}: only ${lines.length} events, skipping.`);
        continue;
      }
      pulled.push({ meta, lines });
      log(`  pulled ${meta.homeTeam} v ${meta.awayTeam}: ${lines.length} events`);
    } catch (err) {
      log(`  ${meta.homeTeam} v ${meta.awayTeam}: ${(err as Error).message}`);
    }
  }

  return pulled;
}
