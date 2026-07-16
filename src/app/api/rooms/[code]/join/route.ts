import type { NextRequest } from "next/server";
import { handle, ok } from "../../../../../server/http";
import { joinRoom, joinRoomSchema } from "../../../../../server/rooms";

export const dynamic = "force-dynamic";

// Join a room through its link.
export async function POST(
  request: NextRequest,
  { params }: { params: { code: string } },
) {
  return handle(async () => {
    const input = joinRoomSchema.parse(await request.json());
    const bundle = await joinRoom(params.code.toUpperCase(), input);
    return ok(bundle);
  });
}
