// Small helpers for JSON API responses so the route files stay short.

import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function fail(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

// Runs a handler and turns thrown errors into clean JSON responses. Validation
// errors become 400s; anything else becomes a 400 with its message.
export async function handle(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ZodError) {
      return fail(err.issues.map((i) => i.message).join(", "), 400);
    }
    const message = err instanceof Error ? err.message : "Something went wrong";
    return fail(message, 400);
  }
}
