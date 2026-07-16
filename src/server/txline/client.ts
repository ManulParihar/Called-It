// Opens the live scores stream and turns it into a series of MatchEvent values.
//
// It keeps the connection open, reconnects if it drops, and refreshes the guest
// token when a request comes back 401. Messages for fixtures we do not care
// about are skipped, so only rooms with an active game get processed.

import type { MatchEvent } from "../../lib/match";
import { CredentialStore } from "./auth";
import { normalizeScoresData } from "./normalize";
import { readSseMessages } from "./sse";

type Raw = Record<string, unknown>;

function fixtureIdOf(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const raw = data as Raw;
  for (const key of ["FixtureId", "MatchId", "EventId", "GameId", "Id"]) {
    const value = raw[key];
    if (typeof value === "string") return value;
    if (typeof value === "number") return String(value);
  }
  return undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface StreamOptions {
  store: CredentialStore;
  baseUrl: string;
  // Return true for fixtures that have an active room.
  shouldInclude: (fixtureId: string) => boolean;
  // Milliseconds to wait before reconnecting after the stream drops.
  reconnectMs?: number;
}

export async function* streamScores(
  options: StreamOptions,
): AsyncGenerator<MatchEvent> {
  const { store, baseUrl, shouldInclude } = options;
  const reconnectMs = options.reconnectMs ?? 3000;
  const url = `${baseUrl}/api/scores/stream`;

  while (true) {
    let creds = await store.current();
    const res = await fetch(url, {
      headers: {
        ...store.authHeaders(creds),
        Accept: "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });

    if (res.status === 401) {
      // Guest token expired. Get a new one and reconnect right away.
      await store.refresh();
      continue;
    }
    if (!res.ok || !res.body) {
      await sleep(reconnectMs);
      continue;
    }

    try {
      for await (const message of readSseMessages(res)) {
        if (!message.data) continue;
        let data: unknown;
        try {
          data = JSON.parse(message.data);
        } catch {
          continue;
        }
        const fixtureId = fixtureIdOf(data);
        if (!fixtureId || !shouldInclude(fixtureId)) continue;

        const receivedAt = new Date().toISOString();
        for (const event of normalizeScoresData(data, fixtureId, receivedAt)) {
          yield event;
        }
      }
    } catch {
      // The stream errored. Fall through to reconnect.
    }

    await sleep(reconnectMs);
  }
}
