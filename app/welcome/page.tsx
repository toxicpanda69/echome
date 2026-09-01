import { DISCLAIMER } from "@/lib/echo/messages";

export const dynamic = "force-dynamic";

/** Where Stripe returns after a successful checkout. */
export default function WelcomePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-5 px-5 py-14">
      <h1 className="text-2xl font-medium tracking-tight">You&rsquo;re in</h1>
      <p className="text-ink-soft">
        Two things worth doing before you start. Connect your xTiles workspace, so there is
        somewhere for what you keep to go. And know that nothing you say here is stored in
        readable form — when a conversation ends, the transcript is destroyed.
      </p>
      <div className="flex flex-wrap gap-3">
        <a href="/chat" className="rounded-lg bg-ink px-4 py-2.5 font-medium text-page">
          Start a conversation
        </a>
        <a href="/account" className="rounded-lg border border-line px-4 py-2.5 text-ink-soft">
          Connect xTiles
        </a>
      </div>
      <p className="text-xs leading-relaxed text-ink-soft">{DISCLAIMER}</p>
    </main>
  );
}
