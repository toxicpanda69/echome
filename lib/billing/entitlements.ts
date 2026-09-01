import "server-only";

import { LOCAL_MODE } from "@/lib/local/mode";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tier } from "@/lib/config/pricing";

/**
 * What someone is entitled to.
 *
 * The only writer is the Stripe webhook. Nothing in the request path can grant
 * an entitlement — checkout completing in the browser is not proof of payment,
 * a signed webhook is.
 */

export type EntitlementStatus = "inactive" | "active" | "past_due" | "canceled";

export interface Entitlement {
  readonly tier: Tier | "none";
  readonly status: EntitlementStatus;
  readonly currentPeriodEnd: Date | null;
  readonly stripeCustomerId: string | null;
}

const NONE: Entitlement = {
  tier: "none",
  status: "inactive",
  currentPeriodEnd: null,
  stripeCustomerId: null,
};

export async function entitlementFor(userId: string): Promise<Entitlement> {
  // Local mode has no Stripe. Everything is unlocked so the app is testable;
  // this is one more reason local mode must never reach production.
  if (LOCAL_MODE) {
    return { tier: "founders", status: "active", currentPeriodEnd: null, stripeCustomerId: null };
  }

  const { data, error } = await createAdminClient()
    .from("entitlements")
    .select("tier, status, current_period_end, stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle<{
      tier: Tier | "none";
      status: EntitlementStatus;
      current_period_end: string | null;
      stripe_customer_id: string | null;
    }>();

  if (error) throw error;
  if (!data) return NONE;

  return {
    tier: data.tier,
    status: data.status,
    currentPeriodEnd: data.current_period_end ? new Date(data.current_period_end) : null,
    stripeCustomerId: data.stripe_customer_id,
  };
}

/**
 * May this person hold a conversation?
 *
 * Three ways in: a paid entitlement, an active subscription period, or the one
 * free introductory conversation.
 */
export interface Access {
  readonly allowed: boolean;
  readonly reason: "paid" | "free-intro" | "needs-purchase" | "lapsed";
}

export async function accessFor(userId: string): Promise<Access> {
  const entitlement = await entitlementFor(userId);

  if (entitlement.status === "active") return { allowed: true, reason: "paid" };
  if (entitlement.status === "past_due") {
    // A failed card should not lock someone out of a conversation mid-thought.
    // Stripe retries for days; we keep them in until it gives up.
    return { allowed: true, reason: "paid" };
  }
  if (entitlement.tier !== "none" && entitlement.status === "canceled") {
    return { allowed: false, reason: "lapsed" };
  }

  if (LOCAL_MODE) return { allowed: true, reason: "paid" };

  const { data } = await createAdminClient()
    .from("profiles")
    .select("free_intro_used")
    .eq("id", userId)
    .maybeSingle<{ free_intro_used: boolean }>();

  return data && !data.free_intro_used
    ? { allowed: true, reason: "free-intro" }
    : { allowed: false, reason: "needs-purchase" };
}

/** Called when a free introductory conversation begins. Once per account. */
export async function consumeFreeIntro(userId: string): Promise<void> {
  if (LOCAL_MODE) return;
  await createAdminClient().from("profiles").update({ free_intro_used: true }).eq("id", userId);
}

export async function grantEntitlement(params: {
  userId: string;
  tier: Tier;
  status: EntitlementStatus;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: Date | null;
}): Promise<void> {
  const { error } = await createAdminClient()
    .from("entitlements")
    .upsert(
      {
        user_id: params.userId,
        tier: params.tier,
        status: params.status,
        stripe_customer_id: params.stripeCustomerId,
        stripe_subscription_id: params.stripeSubscriptionId,
        current_period_end: params.currentPeriodEnd?.toISOString() ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  if (error) throw error;
}

export async function setEntitlementStatus(
  stripeCustomerId: string,
  status: EntitlementStatus,
  currentPeriodEnd: Date | null,
): Promise<void> {
  const { error } = await createAdminClient()
    .from("entitlements")
    .update({
      status,
      current_period_end: currentPeriodEnd?.toISOString() ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_customer_id", stripeCustomerId);
  if (error) throw error;
}
