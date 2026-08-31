import "server-only";

import { getLocalUser } from "@/lib/local/auth";
import { LOCAL_MODE } from "@/lib/local/mode";
import { getUser as getSupabaseUser } from "@/lib/supabase/server";

/**
 * The signed-in person, from whichever authority is in charge.
 *
 * Every page and route asks this rather than Supabase directly, so local mode
 * is one branch in one file instead of a condition scattered through the app.
 */

export interface CurrentUser {
  readonly id: string;
  readonly email: string | null;
}

export async function currentUser(): Promise<CurrentUser | null> {
  if (LOCAL_MODE) {
    const local = await getLocalUser();
    return local ? { id: local.id, email: local.email } : null;
  }

  const user = await getSupabaseUser();
  return user ? { id: user.id, email: user.email ?? null } : null;
}
