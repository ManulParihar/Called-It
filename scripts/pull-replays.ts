// Pulls the last few finished World Cup matches from TxLINE and writes them as
// recorded timelines the app can replay for testing.
//
// For each match it fetches the full historical score sequence, folds it into
// the JSON Lines shape the replay tools use, and writes data/replays/<id>.jsonl.
// It also writes data/replays/index.json with the fixture metadata so the seed
// can insert these as replay fixtures.
//
// Run it with: npm run pull:replays
// It needs TXLINE_API_TOKEN in the environment. Without it, or if the feed is
// unreachable, it exits with a message and the app keeps using the built in
// sample match for replays.

import { mkdirSync, writeFileSync } from "node:fs";
import { loadEnv } from "../src/server/env";
import { CredentialStore, baseUrl } from "../src/server/txline/auth";
import { fetchHistorical, scoresToReplayLines } from "../src/server/txline/history";
import type { ReplayLine } from "../src/server/txline/replay";

const REPLAY_DIR = "data/replays";
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

interface ReplayMeta {
  id: string;
  txFixtureId: string;
  competition: string;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: string;
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
async function findCandidates(store: CredentialStore): Promise<FeedFixture[]> {
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
      console.warn(`  snapshot for day -${offset} failed:`, (err as Error).message);
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

function writeLog(txFixtureId: string, lines: ReplayLine[]): void {
  const body = lines.map((l) => JSON.stringify(l)).join("\n") + "\n";
  writeFileSync(`${REPLAY_DIR}/${txFixtureId}.jsonl`, body);
}

async function main(): Promise<void> {
  loadEnv();

  let store: CredentialStore;
  try {
    store = new CredentialStore();
  } catch (err) {
    console.error((err as Error).message);
    console.error("Set TXLINE_API_TOKEN to pull real replays. Skipping.");
    process.exit(1);
  }

  mkdirSync(REPLAY_DIR, { recursive: true });

  console.log("Looking for recently finished World Cup matches...");
  const candidates = await findCandidates(store);
  console.log(`Found ${candidates.length} candidate fixtures in the historical window.`);

  const saved: ReplayMeta[] = [];
  for (const row of candidates) {
    if (saved.length >= WANT) break;
    const meta = metaFor(row);
    try {
      const scores = await fetchHistorical(store, meta.txFixtureId);
      const lines = scoresToReplayLines(scores);
      if (lines.length < MIN_LINES) {
        console.warn(`  ${meta.homeTeam} v ${meta.awayTeam}: only ${lines.length} events, skipping.`);
        continue;
      }
      writeLog(meta.txFixtureId, lines);
      saved.push(meta);
      console.log(`  saved ${meta.homeTeam} v ${meta.awayTeam}: ${lines.length} events -> ${REPLAY_DIR}/${meta.txFixtureId}.jsonl`);
    } catch (err) {
      console.warn(`  ${meta.homeTeam} v ${meta.awayTeam}: ${(err as Error).message}`);
    }
  }

  writeFileSync(`${REPLAY_DIR}/index.json`, JSON.stringify(saved, null, 2) + "\n");
  console.log(`Wrote ${saved.length} replays and ${REPLAY_DIR}/index.json.`);
  if (saved.length === 0) {
    console.log("No replays pulled. The app will fall back to the sample match.");
  }
}

main().catch((err) => {
  console.error("Pull failed", err);
  process.exit(1);
});
