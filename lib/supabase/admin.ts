import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. Bypasses Row Level Security.
 *
 * This is the ONLY module that reads SUPABASE_SERVICE_ROLE_KEY. The
 * `server-only` import above makes importing it from a client component a build
 * error rather than a leaked key.
 *
 * It exists because live_sessions has no RLS policies — the encrypted rows are
 * unreachable from any user-scoped client by design — so the server route
 * handlers must use this. Every caller passes an explicit user id and every
 * store query filters on it; the row-level check moves from Postgres into
 * lib/echo/postgres-store.ts, which is why that file never exposes a query
 * without a user id.
 */
let cached: SupabaseClient | null = null;

export function createAdminClient(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase admin client needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
