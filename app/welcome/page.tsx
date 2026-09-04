import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/fields";
import { currentUser } from "@/lib/auth/current-user";
import { DISCLAIMER } from "@/lib/echo/messages";
import { xtiles } from "@/lib/xtiles/factory";

/**
 * The hub every sign-in lands on — two main options, nothing else competing
 * for attention. "Start a conversation" always works; resumeOrStartSession
 * picks up an open one automatically, so there's no separate "continue"
 * choice to design for. "Connect xTiles" only matters once: after that, this
 * option quietly reports that it's done rather than asking again.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { checkout } = await searchParams;
  const user = await currentUser();
  if (!user) redirect("/login?next=/welcome");

  const connected = await (await xtiles()).isConnected(user.id).catch(() => false);

  return (
    <AuthShell>
      <h1 className="text-center text-2xl font-medium tracking-tight">You&rsquo;re in</h1>
      <p className="mt-2 text-center text-sm text-ink-soft">
        Two things you can do from here.
      </p>

      {checkout === "complete" ? (
        <p className="mt-5 rounded-xl border border-accent/40 bg-accent-soft px-3.5 py-2.5 text-center text-sm leading-relaxed text-ink">
          Payment received — you&rsquo;re all set.
        </p>
      ) : null}

      <div className="mt-7 flex flex-col gap-3">
        <a
          href="/chat"
          className="flex flex-col gap-0.5 rounded-2xl border border-line bg-page px-4 py-3.5 transition hover:border-accent"
        >
          <span className="text-base font-medium">Start a conversation</span>
          <span className="text-sm text-ink-soft">
            Pick up where you left off, or begin something new.
          </span>
        </a>

        {connected ? (
          <a
            href="/account"
            className="flex flex-col gap-0.5 rounded-2xl border border-line bg-page px-4 py-3.5 transition hover:border-accent"
          >
            <span className="flex items-center gap-2 text-base font-medium">
              xTiles connected
              <span aria-hidden="true" className="text-accent">
                ✓
              </span>
            </span>
            <span className="text-sm text-ink-soft">What you keep from a conversation goes here.</span>
          </a>
        ) : (
          <form action="/api/xtiles/connect" method="post">
            <button
              type="submit"
              className="flex w-full flex-col gap-0.5 rounded-2xl border border-line bg-page px-4 py-3.5 text-left transition hover:border-accent"
            >
              <span className="text-base font-medium">Connect your xTiles workspace</span>
              <span className="text-sm text-ink-soft">
                So there&rsquo;s somewhere for what you keep to go.
              </span>
            </button>
          </form>
        )}
      </div>

      <p className="mt-6 text-center text-xs leading-relaxed text-ink-soft">{DISCLAIMER}</p>
    </AuthShell>
  );
}
