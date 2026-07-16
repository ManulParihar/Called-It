import type { NextRequest } from "next/server";
import { handle, ok } from "../../../../../server/http";
import { submitAnswers, submitAnswersSchema } from "../../../../../server/rooms";

export const dynamic = "force-dynamic";

// Lock in a player's five swipes.
export async function POST(
  request: NextRequest,
  { params }: { params: { code: string } },
) {
  return handle(async () => {
    const input = submitAnswersSchema.parse(await request.json());
    await submitAnswers(params.code.toUpperCase(), input);
    return ok({ saved: true });
  });
}
