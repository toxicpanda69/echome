"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";

/**
 * Auth server actions.
 *
 * Two rules specific to this app:
 *   - Supabase auth errors are mapped to our own wording. The raw strings leak
 *     whether an address is registered, which is a privacy problem anywhere and
 *     more so for a product people use to think about private things.
 *   - Nothing here logs an email address or a password. Not on the error path
 *     either.
 */

export interface AuthState {
  readonly error?: string;
  readonly notice?: string;
}

async function siteUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  // Fall back to the request's own origin so preview deploys work unattended.
  const host = (await headers()).get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

function readCredentials(formData: FormData): { email: string; password: string } | null {
  const email = formData.get("email");
  const password = formData.get("password");
  if (typeof email !== "string" || typeof password !== "string") return null;
  if (email.trim().length === 0 || password.length === 0) return null;
  return { email: email.trim(), password };
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const credentials = readCredentials(formData);
  if (!credentials) return { error: "Please enter an email address and a password." };
  if (credentials.password.length < 8) {
    return { error: "Please choose a password of at least 8 characters." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    ...credentials,
    options: { emailRedirectTo: `${await siteUrl()}/auth/confirm` },
  });

  if (error) {
    return { error: "We couldn't create that account. Check the address and try again." };
  }

  // Supabase returns a user with an empty identities array when the address is
  // already registered. Say the same thing either way rather than confirming it.
  if (data.session) redirect("/chat");
  return { notice: "Check your email for a link to confirm your account." };
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const credentials = readCredentials(formData);
  if (!credentials) return { error: "Please enter an email address and a password." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(credentials);
  if (error) return { error: "That email and password don't match. Please try again." };

  const next = formData.get("next");
  redirect(typeof next === "string" && next.startsWith("/") ? next : "/chat");
}

export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = formData.get("email");
  if (typeof email !== "string" || email.trim().length === 0) {
    return { error: "Please enter your email address." };
  }

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${await siteUrl()}/auth/confirm?next=/reset/update`,
  });

  // Always the same answer, whether or not the address exists.
  return { notice: "If that address has an account, a reset link is on its way." };
}

export async function updatePassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const password = formData.get("password");
  if (typeof password !== "string" || password.length < 8) {
    return { error: "Please choose a password of at least 8 characters." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: "That reset link has expired. Please request a new one." };
  }
  redirect("/chat");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * SEAM FOR GOOGLE OAUTH — deliberately not wired up.
 *
 * Everything server-side is in place: this action, and /auth/callback which
 * already exchanges the code for a session. Turning it on is three steps:
 *   1. enable the Google provider in the Supabase dashboard,
 *   2. render a button in components/auth/AuthForm.tsx that calls this,
 *   3. add the redirect URI to the Google console.
 *
 * Nothing else in the codebase assumes password auth, and the profiles trigger
 * fires for OAuth signups the same way.
 */
export async function signInWithOAuth(provider: "google"): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${await siteUrl()}/auth/callback` },
  });
  if (error || !data.url) redirect("/login?error=oauth");
  redirect(data.url);
}
