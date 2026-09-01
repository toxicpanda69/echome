import "server-only";

import { Resend } from "resend";

import { TIERS, type Tier } from "@/lib/config/pricing";
import { classifyError } from "@/lib/echo/telemetry";
import { LOCAL_MODE } from "@/lib/local/mode";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Transactional email.
 *
 * Two messages exist in Phase 3: the post-purchase pack, and the inactivity
 * nudge. Both are triggered by something the person did (or stopped doing) and
 * neither is marketing.
 *
 * Neither one ever contains conversation content. The nudge in particular is a
 * trap worth naming: "want to finish this conversation?" must not include a
 * reminder of what the conversation was about, however helpful that would feel.
 *
 * WORDING IS PLACEHOLDER. The client owns the copy, the Echo Circle link, and
 * the xTiles setup instructions.
 */

const FROM = process.env.RESEND_FROM ?? "EchoMe <hello@echomechat.ai>";
const ECHO_CIRCLE_URL = process.env.ECHO_CIRCLE_URL ?? null;

let client: Resend | null = null;

function resend(): Resend {
  if (!client) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY is not set.");
    client = new Resend(key);
  }
  return client;
}

async function emailFor(userId: string): Promise<string | null> {
  const { data } = await createAdminClient()
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle<{ email: string }>();
  return data?.email ?? null;
}

async function send(to: string, subject: string, body: string): Promise<void> {
  if (LOCAL_MODE) {
    // No mail is sent locally. The subject is logged so the flow is visible;
    // the recipient is not, because that is somebody's address.
    console.warn(`[email] local mode — would have sent: ${subject}`);
    return;
  }
  const { error } = await resend().emails.send({ from: FROM, to, subject, text: body });
  if (error) throw new Error(`Resend rejected the message: ${error.name}`);
}

/** PLACEHOLDER COPY — client to supply. */
export async function sendPostPurchasePack(userId: string, tier: Tier): Promise<void> {
  const to = LOCAL_MODE ? "local@example.com" : await emailFor(userId);
  if (!to) {
    console.error("[email] no address on file for this account");
    return;
  }

  const config = TIERS[tier];
  const lines = [
    "Welcome to EchoMe.",
    "",
    `You have ${config.name}. Here is what to do next.`,
    "",
    "1. Connect your xTiles workspace",
    "   EchoMe writes what you keep into your own xTiles, not into our database.",
    "   Sign in and visit Account to connect it. Until you do, conversations",
    "   cannot be closed and kept.",
    "",
    "2. Start a conversation",
    "   Sign in and begin. A conversation lives on the server for days — close",
    "   the laptop, come back on your phone, it is still there mid-thought.",
    "",
    ECHO_CIRCLE_URL ? `3. Join the Echo Circle\n   ${ECHO_CIRCLE_URL}` : null,
    "",
    "One thing worth knowing: nothing you say is stored in readable form. Not",
    "by us, not by anyone. When a conversation ends, the transcript is destroyed",
    "and only what you chose to keep survives, in your own workspace.",
    "",
    "EchoMe is not therapy and is not a substitute for it.",
  ].filter((line): line is string => line !== null);

  await send(to, "Your EchoMe access", lines.join("\n"));
}

/**
 * The inactivity nudge.
 *
 * Contains no hint of what the conversation was about — not a topic, not a
 * first line, not a word count. It says only that something is unfinished.
 */
export async function sendInactivityNudge(userId: string, siteUrl: string): Promise<void> {
  const to = LOCAL_MODE ? "local@example.com" : await emailFor(userId);
  if (!to) return;

  const body = [
    "You have a conversation open in EchoMe.",
    "",
    "There is no hurry, and nothing expires. But if it feels finished, ending it",
    "properly is worth the few minutes — you get to choose what to keep, it goes",
    "into your own xTiles, and the rest is destroyed.",
    "",
    `${siteUrl}/close`,
    "",
    "If you would rather keep going, just carry on where you left off.",
  ].join("\n");

  await send(to, "An unfinished conversation", body);
}

/** Never throws into a caller. Email is never worth failing a request over. */
export async function trySend(task: Promise<void>, label: string): Promise<void> {
  try {
    await task;
  } catch (error) {
    console.error(`[email] ${label} failed: ${classifyError(error)}`);
  }
}
