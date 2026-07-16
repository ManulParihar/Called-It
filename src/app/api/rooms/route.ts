import type { NextRequest } from "next/server";
import { handle, ok } from "../../../server/http";
import { createRoom, createRoomSchema } from "../../../server/rooms";

export const dynamic = "force-dynamic";

// Create a room. The caller becomes the creator and first member.
export async function POST(request: NextRequest) {
  return handle(async () => {
    const input = createRoomSchema.parse(await request.json());
    const bundle = await createRoom(input);
    return ok(bundle, 201);
  });
}
