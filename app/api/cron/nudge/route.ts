import { NextResponse, type NextRequest } from "next/server";

import { sendInactivityNudge, trySend } from "@/lib/email/pack";
import { classifyError } from "@/lib/echo/telemetry";
import { siteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The inactivity nudge. A Vercel Cron job.
 *
 * From the build brief: "finds sessions idle 48–72 hours and sends the 'want to
 * finish this conversation?' prompt by email and in-app. This is the only thing
 * that starts a closing ritual. Make the window configurable."
 *
 * "The only thing that starts a closing ritual" is the load-bearing sentence.
 * Nothing here closes anything. It sends one message and sets nudged_at. The
 * person decides.
 *
 * The email contains no hint of what the conversation was about — see
 * lib/email/pack.ts.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Configurable, as asked. Hours. */
const IDLE_AFTER_HOURS = Number(process.env.NUDGE_IDLE_HOURS ?? 48);
const IDLE_UNTIL_HOURS = Number(process.env.NUDGE_IDLE_UNTIL_HOURS ?? 72);
const BATCH = Number(process.env.NUDGE_BATCH ?? 100);

export async function GET(request: NextRequest) {
  // Vercel Cron signs its requests with this header. Without the check, anyone
  // could trigger a mailout by hitting the URL.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const provided = request.headers.get("authorization");
    if (provided !== `Bearer ${secret}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  const now = Date.now();
  const idleSince = new Date(now - IDLE_AFTER_HOURS * 3600_000).toISOString();
  // The upper bound stops us nudging a conversation abandoned months ago as if
  // it were fresh. Those need a different message, which is not built.
  const notBefore = new Date(now - IDLE_UNTIL_HOURS * 3600_000).toISOString();

  const db = createAdminClient();

  try {
    const { data, error } = await db
      .from("live_sessions")
      .select("id, user_id")
      .eq("status", "open")
      .is("nudged_at", null)
      .lt("last_active_at", idleSince)
      .gt("last_active_at", notBefore)
      .limit(BATCH)
      .returns<{ id: string; user_id: string }[]>();

    if (error) throw error;

    const base = await siteUrl();
    let sent = 0;

    for (const session of data ?? []) {
      // Marked first. If the send fails we would rather miss a nudge than send
      // the same person the same message on every cron run.
      const { error: markError } = await db
        .from("live_sessions")
        .update({ nudged_at: new Date().toISOString() })
        .eq("id", session.id)
        .is("nudged_at", null);
      if (markError) continue;

      await trySend(sendInactivityNudge(session.user_id, base), "inactivity nudge");
      sent += 1;
    }

    // Counts only. No ids, no addresses.
    return NextResponse.json({ scanned: data?.length ?? 0, sent });
  } catch (error) {
    console.error(`[cron] nudge failed: ${classifyError(error)}`);
    return new NextResponse("Nudge failed", { status: 500 });
  }
}
