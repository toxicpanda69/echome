import { NextResponse, type NextRequest } from "next/server";

import { currentUser } from "@/lib/auth/current-user";
import { entitlementFor } from "@/lib/billing/entitlements";
import { stripe } from "@/lib/billing/stripe";
import { priceIdFor, TIERS, type Tier } from "@/lib/config/pricing";
import { GENERIC_ERROR, NOT_SIGNED_IN } from "@/lib/echo/messages";
import { classifyError } from "@/lib/echo/telemetry";
import { siteUrl } from "@/lib/site-url";

/** Starts a hosted Stripe Checkout session. Card details never reach us. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: NOT_SIGNED_IN }, { status: 401 });

  const form = await request.formData();
  const tier = form.get("tier");
  if (tier !== "access" && tier !== "founders") {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  const config = TIERS[tier as Tier];
  const base = await siteUrl();

  try {
    const existing = await entitlementFor(user.id);
    const session = await stripe().checkout.sessions.create({
      mode: config.mode,
      line_items: [{ price: priceIdFor(tier), quantity: 1 }],
      // Both, because Stripe surfaces these in different places depending on
      // the mode, and the webhook needs the user id whichever one survives.
      client_reference_id: user.id,
      metadata: { user_id: user.id, tier },
      ...(config.mode === "subscription"
        ? { subscription_data: { metadata: { user_id: user.id, tier } } }
        : {}),
      ...(existing.stripeCustomerId
        ? { customer: existing.stripeCustomerId }
        : user.email
          ? { customer_email: user.email }
          : {}),
      success_url: `${base}/welcome?checkout=complete`,
      cancel_url: `${base}/pricing?checkout=cancelled`,
    });

    if (!session.url) throw new Error("Stripe returned no checkout URL.");
    return NextResponse.redirect(session.url, { status: 303 });
  } catch (error) {
    console.error(`[stripe] checkout failed: ${classifyError(error)}`);
    return NextResponse.redirect(`${base}/pricing?checkout=error`, { status: 303 });
  }
}
