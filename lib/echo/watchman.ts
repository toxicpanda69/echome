import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { LOCAL_MODE } from "@/lib/local/mode";
import { classifyError } from "@/lib/echo/telemetry";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The watchman.
 *
 * From the build brief: "a claude-haiku-4-5 classification pass over each user
 * message, max_tokens 256, returning a flag only. It never rewrites and never
 * blocks."
 *
 * Three things follow from "never blocks":
 *   - it runs alongside the conversation, not in front of it. A person mid
 *     thought is never made to wait on a safety classifier.
 *   - if it fails, the turn proceeds. A classifier outage must not silence
 *     someone who is reaching out.
 *   - it returns a category. It does not return a rewritten message, a score
 *     attached to their words, or an explanation quoting them.
 *
 * What is stored is a category and a timestamp. Never the message.
 */

export const WATCHMAN_MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 256;

export const FLAG_CATEGORIES = [
  "none",
  "self-harm",
  "harm-to-others",
  "acute-distress",
  "medical-emergency",
] as const;

export type FlagCategory = (typeof FLAG_CATEGORIES)[number];

/** Categories that cause the interface to surface crisis resources. */
const SURFACING: readonly FlagCategory[] = [
  "self-harm",
  "harm-to-others",
  "acute-distress",
  "medical-emergency",
];

export function shouldSurfaceResources(category: FlagCategory): boolean {
  return SURFACING.includes(category);
}

const INSTRUCTIONS = `You classify a single message from someone in a reflective conversation.

Reply with exactly one word from this list and nothing else:

none                a difficult or sad message, but not an emergency
self-harm           they describe intent, a plan, or active risk of harming themselves
harm-to-others      they describe intent or a plan to harm someone else
acute-distress      they are in crisis right now and need a person, not a reflection
medical-emergency   they describe a medical situation needing immediate attention

Be conservative in both directions. Sadness, grief, exhaustion, hopelessness
about a situation, and dark humour are "none" — this is a reflective app and
people bring hard things to it. Reserve the other categories for someone who
needs help now.`;

let client: Anthropic | null = null;

function anthropic(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set.");
    client = new Anthropic({ apiKey });
  }
  return client;
}

/**
 * Classify one message.
 *
 * Never throws. A failure returns "none" and is recorded as an error class —
 * because the alternative, failing the turn, would mean an outage in the safety
 * classifier stops someone talking at the exact moment it matters most.
 */
export async function watch(text: string): Promise<FlagCategory> {
  if (LOCAL_MODE && !process.env.ANTHROPIC_API_KEY) return "none";

  try {
    const response = await anthropic().beta.messages.create({
      model: WATCHMAN_MODEL,
      max_tokens: MAX_TOKENS,
      system: INSTRUCTIONS,
      messages: [{ role: "user", content: text }],
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });

    if (response.stop_reason === "refusal") return "none";

    const word = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block as Anthropic.Beta.BetaTextBlock).text)
      .join("")
      .trim()
      .toLowerCase();

    const match = FLAG_CATEGORIES.find((category) => word.startsWith(category));
    return match ?? "none";
  } catch (error) {
    console.warn(`[watchman] classification failed: ${classifyError(error)}`);
    return "none";
  }
}

/** Record a flag. Category and time only — there is no column for the text. */
export async function recordFlag(
  userId: string,
  sessionId: string,
  category: FlagCategory,
): Promise<void> {
  if (category === "none") return;

  if (LOCAL_MODE) {
    console.warn(`[watchman] flag recorded locally: ${category}`);
    return;
  }

  try {
    const { error } = await createAdminClient()
      .from("safety_flags")
      .insert({ user_id: userId, session_id: sessionId, category });
    if (error) console.warn(`[watchman] flag insert failed: ${error.code ?? "unknown"}`);
  } catch (error) {
    console.warn(`[watchman] flag insert threw: ${classifyError(error)}`);
  }
}
