import type { NextRequest } from "next/server";
import { z } from "zod";
import { fail, handle, ok } from "../../../../../server/http";
import { devToolsEnabled, simulateRoom } from "../../../../../server/dev/simulate";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  steps: z.number().int().positive().max(100).optional(),
  toEnd: z.boolean().optional(),
});

// Testing only. Replays part or all of the recorded match into a room so the
// live and full time screens can be exercised without a real feed. Disabled in
// production builds.
export async function POST(
  request: NextRequest,
  { params }: { params: { code: string } },
) {
  if (!devToolsEnabled()) {
    return fail("Testing tools are turned off", 403);
  }
  return handle(async () => {
    const raw = await request.json().catch(() => ({}));
    const input = bodySchema.parse(raw);
    const result = await simulateRoom(params.code.toUpperCase(), input);
    return ok(result);
  });
}
