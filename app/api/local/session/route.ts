import { NextResponse } from "next/server";

import { currentUser } from "@/lib/auth/current-user";
import { sessionStore } from "@/lib/echo/store-factory";
import { resumeOrStartSession } from "@/lib/echo/sessions";
import { toDisplayTurns } from "@/lib/echo/transcript";
import { LOCAL_MODE } from "@/lib/local/mode";
import { readRecentTelemetry } from "@/lib/local/telemetry-sink";

/**
 * Everything the local test console needs, in one request: who you are, the
 * current session, its decrypted turns, and the last few turns' metrics.
 *
 * LOCAL MODE ONLY. Outside local mode this route is a 404 — it exposes a
 * decrypted transcript over HTTP, which is fine for a development console
 * talking to your own machine and is not something the real product does.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!LOCAL_MODE) {
    return new NextResponse("Not found", { status: 404 });
  }

  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const session = await resumeOrStartSession(await sessionStore(), user.id);

  return NextResponse.json({
    user: { id: user.id, email: user.email },
    session: {
      id: session.row.id,
      status: session.row.status,
      createdAt: session.row.createdAt,
      lastActiveAt: session.row.lastActiveAt,
      encryptedBytes: session.row.encryptedPayload.length,
    },
    // Which responder the next turn will use, so the console can say so.
    responder: process.env.ANTHROPIC_API_KEY ? "claude" : "local-stub",
    turns: toDisplayTurns(session.transcript),
    telemetry: readRecentTelemetry(20),
  });
}
