import { redirect } from "next/navigation";

import { currentUser } from "@/lib/auth/current-user";
import { entitlementFor } from "@/lib/billing/entitlements";
import { TIERS } from "@/lib/config/pricing";
import { LOCAL_MODE } from "@/lib/local/mode";
import { xtiles } from "@/lib/xtiles/factory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ portal?: string; xtiles?: string }>;
}) {
  const { portal, xtiles: xtilesStatus } = await searchParams;
  const user = await currentUser();
  if (!user) redirect("/login?next=/account");

  const entitlement = await entitlementFor(user.id);
  const connected = await (await xtiles()).isConnected(user.id).catch(() => false);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center gap-7 px-5 py-14">
      <h1 className="text-2xl font-medium tracking-tight">Your account</h1>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Signed in as</h2>
        <p className="text-ink-soft">{user.email ?? user.id}</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Plan</h2>
        <p className="text-ink-soft">
          {entitlement.tier === "none"
            ? "No plan yet — you have one free conversation."
            : `${TIERS[entitlement.tier].name} · ${entitlement.status}`}
          {LOCAL_MODE ? " (local mode unlocks everything)" : null}
        </p>
        {entitlement.stripeCustomerId ? (
          <form action="/api/stripe/portal" method="post">
            <button type="submit" className="rounded-lg border border-line px-4 py-2.5 text-ink-soft">
              Manage billing
            </button>
          </form>
        ) : (
          <a href="/pricing" className="self-start rounded-lg bg-ink px-4 py-2.5 font-medium text-page">
            Choose a plan
          </a>
        )}
        {portal === "error" ? (
          <p className="text-sm text-ink-soft">We couldn&rsquo;t open the billing portal. Try again shortly.</p>
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">xTiles workspace</h2>
        <p className="text-ink-soft">
          {connected
            ? "Connected. What you keep from a conversation is written here."
            : "Not connected. Without it, a conversation can be ended but nothing can be kept."}
        </p>
        {xtilesStatus === "error" ? (
          <p className="text-sm text-ink-soft">That connection didn&rsquo;t complete. Please try again.</p>
        ) : null}
        {!connected ? (
          <form action="/api/xtiles/connect" method="post">
            <button type="submit" className="rounded-lg border border-line px-4 py-2.5 text-ink-soft">
              Connect xTiles
            </button>
          </form>
        ) : null}
      </section>

      <section className="flex flex-col gap-2 border-t border-line pt-6">
        <h2 className="text-sm font-medium">Your conversations</h2>
        <p className="text-sm leading-relaxed text-ink-soft">
          We cannot show you a history, because we do not keep one. A conversation exists only
          while it is open, encrypted with a key that belongs to it alone. When you end it, that
          key is destroyed and what you chose to keep lives in your xTiles, not here.
        </p>
      </section>
    </main>
  );
}
