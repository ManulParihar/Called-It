import type { NextRequest } from "next/server";
import { fail, handle, ok } from "../../../../server/http";
import { getRoomBundle } from "../../../../server/rooms";

export const dynamic = "force-dynamic";

// Read everything about a room by its join code.
export async function GET(
  _request: NextRequest,
  { params }: { params: { code: string } },
) {
  return handle(async () => {
    const bundle = await getRoomBundle(params.code.toUpperCase());
    if (!bundle) return fail("Room not found", 404);
    return ok(bundle);
  });
}
