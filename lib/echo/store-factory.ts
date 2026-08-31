import "server-only";

import type { SessionStore } from "@/lib/echo/store";
import { LOCAL_MODE } from "@/lib/local/mode";

/**
 * Picks the storage backend. The rest of the app never knows which one it got,
 * which is the point of the SessionStore interface.
 *
 * Both are imported dynamically so that neither ends up in the other's bundle.
 * That matters for the local store in particular: it reads a file at a path
 * built from process.cwd(), which the bundler cannot analyse statically, and a
 * static import would drag file tracing across the whole project into every
 * production deploy for the sake of code production never runs.
 */

let cached: SessionStore | null = null;

export async function sessionStore(): Promise<SessionStore> {
  if (cached) return cached;

  if (LOCAL_MODE) {
    const { LocalFileSessionStore } = await import("@/lib/local/store");
    cached = new LocalFileSessionStore();
  } else {
    const { PostgresSessionStore } = await import("@/lib/echo/postgres-store");
    cached = new PostgresSessionStore();
  }

  return cached;
}
