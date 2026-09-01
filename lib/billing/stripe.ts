import "server-only";

import Stripe from "stripe";

/**
 * Stripe.
 *
 * Card data never touches this codebase. Checkout is hosted by Stripe, the
 * Customer Portal is hosted by Stripe, and the only thing that crosses back is
 * a signed webhook carrying identifiers.
 */

let client: Stripe | null = null;

export function stripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set.");
    client = new Stripe(key);
  }
  return client;
}

export function webhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set.");
  return secret;
}

/**
 * Verify a webhook's signature.
 *
 * Must be given the RAW body. Next parses JSON eagerly if you let it, and a
 * re-serialised body produces a different signature — the classic reason a
 * webhook handler "mysteriously" rejects every event.
 */
export function verifyWebhook(rawBody: string, signature: string | null): Stripe.Event {
  if (!signature) throw new Error("Missing stripe-signature header.");
  return stripe().webhooks.constructEvent(rawBody, signature, webhookSecret());
}
