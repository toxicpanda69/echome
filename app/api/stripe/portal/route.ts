import { NextResponse } from "next/server";

import { currentUser } from "@/lib/auth/current-user";
import { entitlementFor } from "@/lib/billing/entitlements";
import { stripe } from "@/lib/billing/stripe";
import { NOT_SIGNED_IN } from "@/lib/echo/messages";
import { classifyError } from "@/lib/echo/telemetry";
import { siteUrl } from "@/lib/site-url";

/** Sends someone to Stripe's Customer Portal to manage their own billing. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: NOT_SIGNED_IN }, { status: 401 });

  const base = await siteUrl();
  const entitlement = await entitlementFor(user.id);
  if (!entitlement.stripeCustomerId) {
    return NextResponse.redirect(`${base}/account?portal=none`, { status: 303 });
  }

  try {
    const session = await stripe().billingPortal.sessions.create({
      customer: entitlement.stripeCustomerId,
      return_url: `${base}/account`,
    });
    return NextResponse.redirect(session.url, { status: 303 });
  } catch (error) {
    console.error(`[stripe] portal failed: ${classifyError(error)}`);
    return NextResponse.redirect(`${base}/account?portal=error`, { status: 303 });
  }
}
