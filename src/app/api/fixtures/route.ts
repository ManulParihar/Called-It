import { getPlayableFixtures } from "../../../server/fixtures";
import { getUpcomingFromTxline } from "../../../server/txline/fixtures";
import { handle, ok } from "../../../server/http";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    // Playable fixtures always render. The upcoming list is a best effort pull
    // from the feed, so a missing token or an outage never breaks the picker.
    const [playable, upcoming] = await Promise.all([
      getPlayableFixtures(),
      getUpcomingFromTxline().catch(() => []),
    ]);
    return ok({ fixtures: [...playable, ...upcoming] });
  });
}
