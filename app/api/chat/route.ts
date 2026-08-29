import { NextResponse, type NextRequest } from "next/server";
import { APIConnectionError, APIError, RateLimitError } from "@anthropic-ai/sdk";

import { DecryptionError, SessionKeyDestroyedError } from "@/lib/echo/crypto";
import {
  GENERIC_ERROR,
  NOT_SIGNED_IN,
  RATE_LIMITED,
  SESSION_CLOSED,
  SESSION_UNREADABLE,
  UPSTREAM_UNAVAILABLE,
} from "@/lib/echo/messages";
import { sessionStore } from "@/lib/echo/postgres-store";
import { appendMessages, resumeOrStartSession } from "@/lib/echo/sessions";
import { classifyError, emptyMetrics, recordTurn } from "@/lib/echo/telemetry";
import { speak } from "@/lib/echo/voice";
import { getUser } from "@/lib/supabase/server";

/** node:crypto is used to decrypt the session, so this cannot run on Edge. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One conversational turn.
 *
 * Ordering that matters: the user's message is encrypted and persisted BEFORE
 * Claude is called. If the model is down, they still have their own words when
 * they come back — losing what somebody wrote while thinking is worse than
 * making them wait.
 *
 * The response is newline-delimited JSON rather than SSE. It carries structured
 * events (text, refusal, error, done) which SSE's text-only frames would make
 * clumsier, and fetch + ReadableStream reads it directly.
 */

type WireEvent =
  | { t: "text"; v: string }
  | { t: "refusal"; v: string }
  | { t: "error"; v: string }
  | { t: "done" };

const MAX_MESSAGE_CHARS = 20_000;

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: NOT_SIGNED_IN }, { status: 401 });

  let text: unknown;
  try {
    ({ text } = await request.json());
  } catch {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }
  if (typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }
  if (text.length > MAX_MESSAGE_CHARS) {
    return NextResponse.json(
      { error: "That's longer than I can take in one go. Try sending it in pieces." },
      { status: 413 },
    );
  }

  const store = sessionStore();

  let session;
  try {
    session = await resumeOrStartSession(store, user.id);
  } catch (error) {
    if (error instanceof SessionKeyDestroyedError) {
      return NextResponse.json({ error: SESSION_CLOSED }, { status: 410 });
    }
    if (error instanceof DecryptionError) {
      return NextResponse.json({ error: SESSION_UNREADABLE }, { status: 500 });
    }
    console.error(`[chat] could not open session: ${classifyError(error)}`);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }

  // Persist their words first. Everything after this point can fail without
  // costing them anything.
  const withUserTurn = await appendMessages(store, session.row, session.transcript, {
    role: "user",
    content: text,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: WireEvent) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));

      try {
        for await (const event of speak(withUserTurn.messages, { signal: request.signal })) {
          switch (event.type) {
            case "text":
              send({ t: "text", v: event.text });
              break;

            case "refusal":
              // Not an error. The client swaps the partial bubble for this.
              send({ t: "refusal", v: event.text });
              break;

            case "done": {
              if (event.assistantMessage) {
                await appendMessages(store, session.row, withUserTurn, event.assistantMessage);
              }
              await recordTurn(user.id, session.row.id, event.metrics);
              send({ t: "done" });
              break;
            }

            case "error": {
              await recordTurn(user.id, session.row.id, event.metrics);
              send({ t: "error", v: userFacing(event.error) });
              break;
            }
          }
        }
      } catch (error) {
        // A failure in persistence or the stream itself. The user's own message
        // is already saved, so this costs them the reply and nothing more.
        const errorClass = classifyError(error);
        console.error(`[chat] turn failed: ${errorClass}`);
        await recordTurn(user.id, session.row.id, {
          ...emptyMetrics(0),
          errorClass,
        });
        send({ t: "error", v: userFacing(error) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      // Vercel and most proxies buffer without this, which would defeat the
      // point of streaming.
      "X-Accel-Buffering": "no",
    },
  });
}

/**
 * Map a failure to something worth reading. Deliberately never includes the
 * upstream message — API error bodies can echo the request, and the request is
 * the conversation.
 */
function userFacing(error: unknown): string {
  if (error instanceof RateLimitError) return RATE_LIMITED;
  if (error instanceof APIConnectionError) return UPSTREAM_UNAVAILABLE;
  if (error instanceof APIError) return UPSTREAM_UNAVAILABLE;
  if (error instanceof SessionKeyDestroyedError) return SESSION_CLOSED;
  if (error instanceof DecryptionError) return SESSION_UNREADABLE;
  return GENERIC_ERROR;
}
