/**
 * Runs before `next build`. Local mode is an authentication bypass, and the
 * guard inside lib/local/mode.ts already refuses to load in production — but
 * that failure surfaces buried inside a Next build trace. This says it plainly
 * before the build even starts.
 */
if (process.env.ECHOME_LOCAL_MODE) {
  console.error(
    "\n\u001b[31mECHOME_LOCAL_MODE is set — refusing to build.\u001b[0m\n\n" +
      "Local mode replaces authentication with a cookie and must never be\n" +
      "compiled into a deployable build. Remove ECHOME_LOCAL_MODE from\n" +
      ".env.local (or from this environment) and build again.\n",
  );
  process.exit(1);
}
