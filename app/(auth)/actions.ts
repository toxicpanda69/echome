"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { isOAuthProvider, PROVIDERS, type OAuthProvider } from "@/lib/auth/providers";
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
 * Passwordless sign-in. Supabase emails a one-time link that lands on
 * /auth/confirm, which exchanges it for a session.
 *
 * `shouldCreateUser` is left at its default of true, so a first-time visitor
 * signing in with a link gets an account — the profiles trigger fires for them
 * exactly as it does for a password signup.
 */
export async function sendMagicLink(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = formData.get("email");
  if (typeof email !== "string" || email.trim().length === 0) {
    return { error: "Please enter your email address." };
  }

  const next = formData.get("next");
  const destination = typeof next === "string" && next.startsWith("/") ? next : "/chat";

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: {
      emailRedirectTo: `${await siteUrl()}/auth/confirm?next=${encodeURIComponent(destination)}`,
    },
  });

  // Rate limiting is the one failure worth naming, because "try again" is
  // actively wrong advice when the answer is "wait".
  if (error?.status === 429) {
    return { error: "That's a few too many links in a row. Please wait a minute and try again." };
  }

  // Otherwise the same answer either way, so this never reveals whether an
  // address has an account.
  return { notice: "Check your email — there's a link waiting that will sign you in." };
}

/**
 * Hand off to a social provider. Returns a redirect to the provider's consent
 * screen; the round trip comes back to /auth/callback.
 *
 * Enabling a provider is a Supabase dashboard toggle plus credentials from the
 * provider's own console. See the setup steps in the README. Until that is
 * done, this fails cleanly and the user lands back on /login with a message
 * rather than on a broken page.
 */
export async function signInWithOAuth(provider: OAuthProvider, next?: string): Promise<void> {
  if (!isOAuthProvider(provider)) redirect("/login?error=oauth");

  const destination = next?.startsWith("/") ? next : "/chat";
  const callback = new URL(`${await siteUrl()}/auth/callback`);
  callback.searchParams.set("next", destination);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: callback.toString(),
      scopes: PROVIDERS[provider].scopes,
    },
  });

  if (error || !data.url) redirect("/login?error=oauth");
  redirect(data.url);
}

/** Form-action wrapper: the provider arrives as a hidden field. */
export async function signInWithProvider(formData: FormData): Promise<void> {
  const provider = formData.get("provider");
  if (!isOAuthProvider(provider)) redirect("/login?error=oauth");
  const next = formData.get("next");
  await signInWithOAuth(provider, typeof next === "string" ? next : undefined);
}
