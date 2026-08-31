/**
 * The social identity providers EchoMe offers.
 *
 * One list, used by the sign-in UI, the server action's validation, and the
 * README setup steps. Adding a provider means adding an entry here and enabling
 * it in the Supabase dashboard — nothing else in the codebase needs to change.
 *
 * A note that belongs with the code rather than in a ticket: signing in with a
 * social provider tells that provider the person uses EchoMe. For a reflective,
 * therapy-adjacent product that is a more meaningful disclosure than it is for
 * most apps, and it belongs in the privacy policy.
 */

export const OAUTH_PROVIDERS = ["google", "facebook"] as const;

export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export function isOAuthProvider(value: unknown): value is OAuthProvider {
  return typeof value === "string" && (OAUTH_PROVIDERS as readonly string[]).includes(value);
}

export interface ProviderConfig {
  readonly id: OAuthProvider;
  readonly label: string;
  /**
   * Scopes beyond the provider's default. Supabase asks for the basics itself;
   * this is only what we need on top.
   */
  readonly scopes?: string;
}

export const PROVIDERS: Readonly<Record<OAuthProvider, ProviderConfig>> = {
  google: {
    id: "google",
    label: "Google",
  },
  facebook: {
    id: "facebook",
    label: "Facebook",
    // Facebook returns no email address without this, and granting it requires
    // Advanced Access on the app — see the setup steps in the README.
    scopes: "email",
  },
};
