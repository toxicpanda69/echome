/**
 * LOCAL MODE — a development-only bypass of Supabase.
 *
 * It replaces two things and nothing else:
 *   - authentication, with a cookie holding whatever email you typed
 *   - the session store, with a JSON file under .echome-local/
 *
 * Everything that matters still runs for real. The transcript is encrypted by
 * the same lib/echo/crypto.ts, with the same AES-256-GCM envelope, the same
 * per-session key and the same destruction path. You can open the file this
 * mode writes and confirm for yourself that there is nothing readable in it.
 *
 * WHY THIS FILE THROWS RATHER THAN WARNS
 *
 * A development auth bypass that quietly survives into production is one of the
 * classic ways an application gets breached. So this does not degrade
 * gracefully: if local mode is switched on anywhere that looks like production,
 * the module throws at import time and the app refuses to start. A crash on
 * deploy is a much better outcome than a running app with no real login.
 *
 * This whole directory is scheduled for deletion in Phase 4's security pass.
 */

const requested = process.env.ECHOME_LOCAL_MODE === "1";

if (requested) {
  const reasons: string[] = [];
  if (process.env.NODE_ENV === "production") reasons.push("NODE_ENV is production");
  if (process.env.VERCEL) reasons.push("running on Vercel");
  if (process.env.VERCEL_ENV) reasons.push(`VERCEL_ENV is ${process.env.VERCEL_ENV}`);

  if (reasons.length > 0) {
    throw new Error(
      `ECHOME_LOCAL_MODE=1 refuses to run here (${reasons.join(", ")}).\n` +
        "Local mode replaces authentication with a cookie and must never be " +
        "enabled outside local development. Remove ECHOME_LOCAL_MODE from this " +
        "environment.",
    );
  }
}

/** True only in local development, with the flag explicitly set. */
export const LOCAL_MODE = requested;

/** Where the local store keeps its encrypted rows. Gitignored. */
export const LOCAL_DATA_DIR = ".echome-local";

/**
 * Guard for code paths that only make sense in local mode. Belt and braces:
 * every local module calls this, so a stray import cannot do anything.
 */
export function assertLocalMode(): void {
  if (!LOCAL_MODE) {
    throw new Error("Local-mode code was reached without ECHOME_LOCAL_MODE=1.");
  }
}

if (LOCAL_MODE) {
  console.warn(
    "\n\u001b[33m┌────────────────────────────────────────────────────────────┐\n" +
      "│  ECHOME IS RUNNING IN LOCAL MODE                           │\n" +
      "│                                                            │\n" +
      "│  Authentication is FAKE. Anyone who can reach this server  │\n" +
      "│  can sign in as anyone by typing an email address.         │\n" +
      "│  Sessions are stored in .echome-local/ instead of Supabase.│\n" +
      "│                                                            │\n" +
      "│  Encryption is real. Never deploy with this enabled.       │\n" +
      "└────────────────────────────────────────────────────────────┘\u001b[0m\n",
  );
}
