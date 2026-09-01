import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";

import { grantEntitlement, setEntitlementStatus } from "@/lib/billing/entitlements";
import { verifyWebhook } from "@/lib/billing/stripe";
import { sendPostPurchasePack } from "@/lib/email/pack";
import { classifyError } from "@/lib/echo/telemetry";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tier } from "@/lib/config/pricing";

/**
 * The Stripe webhook. The only thing in this codebase that grants entitlements.
 *
 * Two properties it must have, both easy to get wrong:
 *
 *   Signature. The raw body is verified before anything is read from it. An
 *   unverified webhook endpoint is an open "make me a paying customer" button.
 *
 *   Idempotency. Stripe retries on any non-2xx, and delivers at-least-once even
 *   when we succeed. Every event id is inserted into stripe_events first; a
 *   duplicate insert means we have already handled it, and we acknowledge
 *   without applying it a second time.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // The RAW body. Parsing and re-serialising changes the signature, which is
  // the usual reason a webhook handler rejects every event it is sent.
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = verifyWebhook(rawBody, request.headers.get("stripe-signature"));
  } catch (error) {
    // 400 rather than 500: Stripe should not retry something that will never
    // verify.
    console.error(`[stripe] signature rejected: ${classifyError(error)}`);
    return new NextResponse("Invalid signature", { status: 400 });
  }

  const db = createAdminClient();

  // Idempotency, before any side effect. 23505 is unique_violation.
  const { error: seenError } = await db
    .from("stripe_events")
    .insert({ id: event.id, type: event.type });

  if (seenError?.code === "23505") {
    return NextResponse.json({ received: true, duplicate: true });
  }
  if (seenError) {
    // We could not record it, so we cannot guarantee once-only. Ask for a retry.
    console.error(`[stripe] could not record event: ${seenError.code ?? "unknown"}`);
    return new NextResponse("Storage error", { status: 500 });
  }

  try {
    await handle(event);
  } catch (error) {
    console.error(`[stripe] handler failed for ${event.type}: ${classifyError(error)}`);
    // Remove the marker, or Stripe's retry will be dismissed as a duplicate and
    // the work will never happen.
    await db.from("stripe_events").delete().eq("id", event.id);
    return new NextResponse("Handler error", { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handle(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = session.client_reference_id ?? session.metadata?.user_id ?? null;
      const tier = (session.metadata?.tier ?? null) as Tier | null;
      if (!userId || !tier) {
        console.error("[stripe] checkout completed without a user id or tier");
        return;
      }

      await grantEntitlement({
        userId,
        tier,
        status: "active",
        stripeCustomerId: typeof session.customer === "string" ? session.customer : null,
        stripeSubscriptionId:
          typeof session.subscription === "string" ? session.subscription : null,
        currentPeriodEnd: null,
      });

      // The post-purchase pack. A failure here must not fail the webhook: they
      // have paid, and a retry would re-grant the entitlement rather than
      // simply re-sending the email.
      await sendPostPurchasePack(userId, tier).catch((error) => {
        console.error(`[stripe] post-purchase pack failed: ${classifyError(error)}`);
      });
      return;
    }

    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      const customerId =
        typeof subscription.customer === "string" ? subscription.customer : null;
      if (!customerId) return;

      const status =
        subscription.status === "active" || subscription.status === "trialing"
          ? "active"
          : subscription.status === "past_due" || subscription.status === "unpaid"
            ? "past_due"
            : "canceled";

      const periodEnd = subscription.items.data[0]?.current_period_end ?? null;
      await setEntitlementStatus(customerId, status, periodEnd ? new Date(periodEnd * 1000) : null);
      return;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : null;
      if (customerId) await setEntitlementStatus(customerId, "past_due", null);
      return;
    }

    default:
      // Everything else is acknowledged and ignored, on purpose.
      return;
  }
}
