import { getReplayFixtures } from "../../../server/fixtures";
import { getTxlineFixtures } from "../../../server/txline/fixtures";
import { handle, ok } from "../../../server/http";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    // Replays live in the database. Live and upcoming matches are a best effort
    // pull from the TxLINE feed, so a missing token or an outage never breaks
    // the picker.
    const [replays, tx] = await Promise.all([
      getReplayFixtures(),
      getTxlineFixtures().catch(() => ({ live: [], upcoming: [] })),
    ]);
    return ok({ fixtures: [...tx.live, ...tx.upcoming, ...replays] });
  });
}
