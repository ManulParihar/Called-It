import type { NextRequest } from "next/server";
import { handle, ok } from "../../../../../server/http";
import { setRoomPool, setRoomPoolSchema } from "../../../../../server/rooms";

export const dynamic = "force-dynamic";

// Records the on chain pool address for a money room and marks a member's stake
// as deposited. Called by the creator after opening the pool and by each joiner
// after their deposit.
export async function POST(
  request: NextRequest,
  { params }: { params: { code: string } },
) {
  return handle(async () => {
    const input = setRoomPoolSchema.parse(await request.json());
    const bundle = await setRoomPool(params.code.toUpperCase(), input);
    return ok(bundle);
  });
}
