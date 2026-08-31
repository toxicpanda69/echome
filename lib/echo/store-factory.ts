import "server-only";

import { PostgresSessionStore } from "@/lib/echo/postgres-store";
import type { SessionStore } from "@/lib/echo/store";
import { LocalFileSessionStore } from "@/lib/local/store";
import { LOCAL_MODE } from "@/lib/local/mode";

/**
 * Picks the storage backend. The rest of the app never knows which one it got,
 * which is the point of the SessionStore interface.
 *
 * Both are imported statically. Neither constructor touches its environment —
 * the Postgres store builds its client lazily, and the local store refuses to
 * construct at all unless local mode is on — so importing both is free.
 */

let cached: SessionStore | null = null;

export function sessionStore(): SessionStore {
  cached ??= LOCAL_MODE ? new LocalFileSessionStore() : new PostgresSessionStore();
  return cached;
}
