import { serverDb } from "../../../../server/db/supabase";
import { devToolsEnabled } from "../../../../server/dev/simulate";
import { fail, handle, ok } from "../../../../server/http";
import { pullRecentReplays } from "../../../../server/txline/pull";

export const dynamic = "force-dynamic";

// Testing only. Pulls the last few finished World Cup matches from TxLINE and
// stores each one as a replay fixture, timeline and all, right on the row. This
// is the refresh button behind the create screen: it does at runtime what the
// pull:replays script does locally, but writes to the database instead of disk
// so it works on a serverless host. Disabled in production builds unless dev
// tools are explicitly turned on.
export async function POST() {
  if (!devToolsEnabled()) {
    return fail("Testing tools are turned off", 403);
  }
  return handle(async () => {
    const pulled = await pullRecentReplays();
    if (pulled.length === 0) {
      return ok({ pulled: 0 });
    }

    const rows = pulled.map(({ meta, lines }) => ({
      id: meta.id,
      competition: meta.competition,
      home_team: meta.homeTeam,
      away_team: meta.awayTeam,
      kickoff_at: meta.kickoffAt,
      kind: "replay",
      tx_fixture_id: meta.txFixtureId,
      replay_log: lines,
    }));

    const db = serverDb();
    const { error } = await db.from("fixtures").upsert(rows, { onConflict: "id" });
    if (error) throw new Error(error.message);

    return ok({ pulled: rows.length });
  });
}
