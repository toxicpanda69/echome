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
  /**
   * Whether this provider has real credentials configured in the Supabase
   * dashboard (see the README's "Enabling Google" / "Enabling Facebook"
   * steps). While false, the button renders disabled with a "Soon" badge
   * instead of a live sign-in form — showing a working-looking button that
   * fails against a placeholder OAuth app is worse than an honest one that
   * says it isn't ready yet.
   *
   * Flipping this to true is the ONLY code change needed to go live once
   * credentials are in place — signInWithProvider and the callback route are
   * already wired and untouched by this flag.
   */
  readonly enabled: boolean;
}

export const PROVIDERS: Readonly<Record<OAuthProvider, ProviderConfig>> = {
  google: {
    id: "google",
    label: "Google",
    enabled: false,
  },
  facebook: {
    id: "facebook",
    label: "Facebook",
    // Facebook returns no email address without this, and granting it requires
    // Advanced Access on the app — see the setup steps in the README.
    scopes: "email",
    enabled: false,
  },
};
