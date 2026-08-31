import "server-only";

import { createHash } from "node:crypto";
import { cookies } from "next/headers";

import { assertLocalMode } from "@/lib/local/mode";

/**
 * Fake authentication. There is no password check, because there is nothing to
 * check against — type an email address and you are that person.
 *
 * The user id is derived from the address rather than random, so it is stable
 * across restarts (your conversation is still there tomorrow) and different
 * addresses are genuinely different users (you can verify that one person
 * cannot see another's session).
 */

const COOKIE = "echome_local_email";

export interface LocalUser {
  readonly id: string;
  readonly email: string;
}

/** Deterministic, UUID-shaped so it behaves like a Supabase auth user id. */
export function localUserId(email: string): string {
  const hash = createHash("sha256").update(`echome-local:${email.trim().toLowerCase()}`).digest("hex");
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `4${hash.slice(13, 16)}`,
    `8${hash.slice(17, 20)}`,
    hash.slice(20, 32),
  ].join("-");
}

export async function getLocalUser(): Promise<LocalUser | null> {
  assertLocalMode();
  const email = (await cookies()).get(COOKIE)?.value;
  if (!email) return null;
  return { id: localUserId(email), email };
}

export async function signInLocal(email: string): Promise<void> {
  assertLocalMode();
  (await cookies()).set(COOKIE, email.trim().toLowerCase(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function signOutLocal(): Promise<void> {
  assertLocalMode();
  (await cookies()).delete(COOKIE);
}

/** Read the cookie straight off a request, for the proxy's signed-in check. */
export function localUserFromCookieValue(value: string | undefined): LocalUser | null {
  return value ? { id: localUserId(value), email: value } : null;
}
