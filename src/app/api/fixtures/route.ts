import { getPlayableFixtures } from "../../../server/fixtures";
import { handle, ok } from "../../../server/http";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const fixtures = await getPlayableFixtures();
    return ok({ fixtures });
  });
}
