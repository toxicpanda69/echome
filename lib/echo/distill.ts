import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import {
  DISTILLATION_SCHEMA,
  parseDistillation,
  type Distillation,
} from "@/lib/echo/schema";
import { classifyError, type TurnMetrics } from "@/lib/echo/telemetry";
import type { Transcript } from "@/lib/echo/transcript";

/**
 * The distiller: a finished conversation in, one EchoMap entry out.
 *
 * The entry format is Todd's (EchoMe skill v3.11, Section 7) and lives in
 * schema.ts. It returns JSON or it fails. Never prose, never a summary
 * paragraph — a paragraph would be a transcript by another name, and would end
 * up written to xTiles and stored forever.
 *
 * The transcript arrives in memory from the caller, is used for one request,
 * and is never written anywhere by this module.
 */

export const DISTILL_MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 4000;

const INSTRUCTIONS = `You read a finished reflective conversation and write one EchoMap entry for it: a short page the person will keep in their own xTiles workspace and find again months from now. Write it in EchoMe's voice: warm, plain, unhurried, never clinical.

You are not summarising and not analysing. Write what this conversation deserved. The entry should match the size and depth of what actually happened, and should never read like paperwork.

HIGHEST PRIORITY — what must never appear in any field:
- Anything the person asked to keep between you, or off the record. This includes the line itself, any paraphrase of it, and anything that answers or refers to it.
- Anything about self-harm, suicide, hopelessness, wanting to disappear, or any other crisis. Leave the moment out entirely, and do not write a sentence or a light that responds to it. The entry may be simply lighter than the conversation was.
- Raw pain repeated back to the person in their own words.
- Names, places, employers, or any other identifying detail.
Before you write any field, decide what falls under these rules, then make sure none of it appears anywhere, in any wording.

Return every field. Use an empty string for any optional field the conversation did not earn.

- title: two to five plain words, like "Just Checking In". No names.
- theme (always): what was this really about? A sentence or two.
- moment: what changed? A realization, a decision, a hard thing said out loud. Only if one truly happened, and only if it is not excluded above.
- leftOff: what still matters. What felt unfinished or worth returning to.
- pattern: only if the same thread clearly surfaced at least three separate times in this conversation. You notice; you never guess, and you never invent a count or a time frame. Almost always empty.
- sentence: optional. One sentence that captures something worth finding again in six months, usually the person's own, occasionally EchoMe's. It must be light enough to want to find again: never a painful line, never anything excluded above. If no sentence qualifies, leave it empty.
- light (always): a light to leave on. One short line of encouragement earned by this conversation: a quote that fits the moment, or a sentence written from it. Never generic. It should only make sense because of what happened here. Warm, and never a response to excluded material.
- thread: the Echo Thread, a short note from EchoMe to EchoMe about how to walk beside this person next time: their pace, how they think, when humor arrives, how they like to be spoken with. One or two sentences at most. The one test: does it help EchoMe meet them more gently next time? If it helps analyse them, it does not belong. Right: "They usually think out loud before they know what they believe." Right: "Humor tends to arrive after trust." Wrong: anything clinical, pattern-labelling or assessing, such as "presents as" or "tends toward", any category a professional might chart, or any description of how they carry things or what they feel. Most conversations teach nothing new, so leave it empty. Rare stays rare.

Size: a brief conversation earns a title, a theme and a light, and nothing else. No manufactured insight. A fuller one adds a moment and where you left off. Only a deep one earns more.

Other rules:
- Write theme, moment, leftOff, pattern and light to the person, as "you". Write thread about them as "they". Never guess or use gender: no he, she, him, her, and no "as a son" or "as a mother".
- Use the person's own words for their struggles, not clinical translations.
- Never diagnose, label the person, score a mood, or assess. No metrics.
- Only the sentence field may repeat the person's words as they said them, and only one sentence. Everywhere else, name the thing; do not transcribe it.
- If the conversation is very slight, still return the small entry (title, theme, light). That is a valid and useful answer.`;

export interface DistillResult {
  readonly distillation: Distillation;
  readonly metrics: TurnMetrics;
}

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
 * Flatten a transcript into the single message the distiller sees.
 *
 * Thinking blocks are dropped — they are Claude's, not the person's, and
 * feeding them to a second model would be reasoning about reasoning.
 */
function asPlainConversation(transcript: Transcript): string {
  return transcript.messages
    .map((message) => {
      const text =
        typeof message.content === "string"
          ? message.content
          : message.content
              .filter((block) => block.type === "text")
              .map((block) => (block as Anthropic.Beta.BetaTextBlockParam).text)
              .join("");
      if (text.trim().length === 0) return null;
      return `${message.role === "user" ? "Them" : "EchoMe"}: ${text}`;
    })
    .filter((line): line is string => line !== null)
    .join("\n\n");
}

export class DistillationFailedError extends Error {
  override readonly name = "DistillationFailedError";
  constructor(readonly reason: string) {
    super(`Distillation failed: ${reason}`);
  }
}

/**
 * Distil one finished conversation.
 *
 * Throws rather than returning a partial result: a half-formed distillation
 * written to someone's xTiles is worse than none, and the closing ritual is
 * built to keep the session alive when this fails.
 */
export async function distill(transcript: Transcript): Promise<DistillResult> {
  const startedAt = performance.now();
  const conversation = asPlainConversation(transcript);

  if (conversation.trim().length === 0) {
    // Nothing was said. Not a failure — there is simply nothing to draw out.
    return {
      distillation: { entry: null },
      metrics: {
        durationMs: 0,
        model: DISTILL_MODEL,
        stopReason: "end_turn",
        errorClass: null,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadInputTokens: null,
        cacheCreationInputTokens: null,
      },
    };
  }

  try {
    const response = await anthropic().beta.messages.parse({
      model: DISTILL_MODEL,
      max_tokens: MAX_TOKENS,
      system: INSTRUCTIONS,
      messages: [{ role: "user", content: conversation }],
      // Structured output. The old top-level output_format is deprecated.
      output_config: { format: { type: "json_schema", schema: DISTILLATION_SCHEMA } },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });

    const metrics: TurnMetrics = {
      durationMs: performance.now() - startedAt,
      model: response.model ?? DISTILL_MODEL,
      stopReason: response.stop_reason,
      errorClass: null,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheReadInputTokens: response.usage.cache_read_input_tokens ?? null,
      cacheCreationInputTokens: response.usage.cache_creation_input_tokens ?? null,
    };

    // Checked before content is read, as everywhere else in this codebase.
    if (response.stop_reason === "refusal") {
      throw new DistillationFailedError("refusal");
    }

    return { distillation: parseDistillation(response.parsed_output), metrics };
  } catch (error) {
    if (error instanceof DistillationFailedError) throw error;
    // The class only. An upstream error body can echo the request back, and the
    // request is the conversation.
    throw new DistillationFailedError(classifyError(error));
  }
}
