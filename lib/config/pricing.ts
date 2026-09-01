/**
 * Pricing.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  PLACEHOLDER AMOUNTS. The build brief says, in brackets:
 *  "[one-time Access tier / monthly Founders tier — confirm final pricing
 *  before writing this]".
 *
 *  The amounts below are for display only and are NOT what Stripe charges.
 *  Stripe charges whatever the price object identified by the env var says, so
 *  a wrong number here is a wrong label, not a wrong charge — but fix both.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type Tier = "access" | "founders";

export interface TierConfig {
  readonly id: Tier;
  readonly name: string;
  readonly blurb: string;
  /** For display. Stripe is the authority on what is actually charged. */
  readonly displayPrice: string;
  readonly cadence: "one-time" | "monthly";
  readonly mode: "payment" | "subscription";
  /** Stripe price id, from the environment. */
  readonly priceIdEnv: "STRIPE_PRICE_ACCESS" | "STRIPE_PRICE_FOUNDERS";
  readonly features: readonly string[];
}

export const TIERS: Readonly<Record<Tier, TierConfig>> = {
  access: {
    id: "access",
    name: "Access",
    blurb: "Pay once. Yours to keep.",
    displayPrice: "$—", // CLIENT TO CONFIRM
    cadence: "one-time",
    mode: "payment",
    priceIdEnv: "STRIPE_PRICE_ACCESS",
    features: [
      "Unlimited reflective conversations",
      "Your EchoCompass and EchoMap in your own xTiles workspace",
      "Nothing you say is ever stored in readable form",
    ],
  },
  founders: {
    id: "founders",
    name: "Founders",
    blurb: "Monthly, with the Echo Circle.",
    displayPrice: "$—/mo", // CLIENT TO CONFIRM
    cadence: "monthly",
    mode: "subscription",
    priceIdEnv: "STRIPE_PRICE_FOUNDERS",
    features: [
      "Everything in Access",
      "The Echo Circle community",
      "Shape what EchoMe becomes",
    ],
  },
};

export function priceIdFor(tier: Tier): string {
  const value = process.env[TIERS[tier].priceIdEnv];
  if (!value) {
    throw new Error(`${TIERS[tier].priceIdEnv} is not set — cannot start checkout for ${tier}.`);
  }
  return value;
}

/**
 * Whether the free introductory conversation requires an account.
 *
 * The build brief asks: "[Confirm with the client whether this requires an
 * account.]" Requiring one is the safer default — it means the free session is
 * once per person rather than once per browser, and it means a conversation
 * someone starts is still there tomorrow, which is the whole product.
 */
export const FREE_INTRO_REQUIRES_ACCOUNT = true;
