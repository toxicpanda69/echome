import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client. Only ever sees the public URL and anon key.
 *
 * Under RLS, this client can reach exactly one table — profiles — and only the
 * caller's own row. live_sessions and turn_telemetry have RLS enabled with no
 * policies at all, so they are invisible from here by construction.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
