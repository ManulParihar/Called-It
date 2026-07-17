// Server side Supabase client. Uses the service role key, so it can write to
// every table and is never sent to the browser. Only import this from server
// code (API routes, the worker), never from a component.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { localDb } from "./local";

let cached: SupabaseClient | null = null;

export function serverDb(): SupabaseClient {
  if (cached) return cached;

  // Local mode keeps every table in a JSON file, so the app runs with no hosted
  // database. See src/server/db/local.ts and the "local" npm script.
  if (process.env.LOCAL_DB === "1") {
    cached = localDb();
    return cached;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing Supabase config. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
