import { redirect } from "next/navigation";

import { signOut } from "@/app/(auth)/actions";
import { localSignOut } from "@/app/(auth)/local-actions";
import { LOCAL_MODE } from "@/lib/local/mode";
import { Conversation } from "@/components/chat/Conversation";
import { BrandHeader } from "@/components/BrandHeader";
import { ProfileMenu } from "@/components/ProfileMenu";
import { DecryptionError, SessionKeyDestroyedError } from "@/lib/echo/crypto";
import { SESSION_CLOSED, SESSION_UNREADABLE } from "@/lib/echo/messages";
import { sessionStore } from "@/lib/echo/store-factory";
import { resumeOrStartSession } from "@/lib/echo/sessions";
import { classifyError } from "@/lib/echo/telemetry";
import { toDisplayTurns, type DisplayTurn } from "@/lib/echo/transcript";
import { currentUser } from "@/lib/auth/current-user";
import { entitlementFor } from "@/lib/billing/entitlements";
import { TIERS } from "@/lib/config/pricing";
import { xtiles } from "@/lib/xtiles/factory";

/**
 * Resuming happens here, and it is the whole product in one function: the
 * server decrypts the conversation, renders it, and hands the browser a copy
 * that exists only in that tab's memory. No client cache, so opening the app on
 * a second device shows the same conversation with no reconciliation.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/chat");

  let turns: DisplayTurn[];
  try {
    const session = await resumeOrStartSession(await sessionStore(), user.id);
    turns = toDisplayTurns(session.transcript);
  } catch (error) {
    if (error instanceof SessionKeyDestroyedError) return <Stopped message={SESSION_CLOSED} />;
    if (error instanceof DecryptionError) return <Stopped message={SESSION_UNREADABLE} />;
    console.error(`[chat] could not open session: ${classifyError(error)}`);
    throw error;
  }

  const [entitlement, xtilesConnected] = await Promise.all([
    entitlementFor(user.id),
    (await xtiles()).isConnected(user.id).catch(() => false),
  ]);
  const planLabel = entitlement.tier === "none" ? "Free" : TIERS[entitlement.tier].name;

  return (
    <>
      <BrandHeader
        trailing={
          <ProfileMenu
            email={user.email}
            planLabel={planLabel}
            xtilesConnected={xtilesConnected}
            signOutAction={LOCAL_MODE ? localSignOut : signOut}
          />
        }
      />
      <Conversation initialTurns={turns} />
    </>
  );
}

function Stopped({ message }: { message: string }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 text-center">
      <p className="text-base leading-relaxed text-ink-soft">{message}</p>
    </main>
  );
}
