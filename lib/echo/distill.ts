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
 * The distiller: a finished conversation in, structured Compass/Map out.
 *
 * It returns JSON or it fails. Never prose, never a summary paragraph — a
 * paragraph would be a transcript by another name, and would end up written to
 * xTiles and stored forever.
 *
 * The transcript arrives in memory from the caller, is used for one request,
 * and is never written anywhere by this module.
 */

export const DISTILL_MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 4000;

const INSTRUCTIONS = `You read a reflective conversation and draw out its structure.

You are not summarising. A summary retells what was said; you are naming what
was underneath it — what the person values, what they are caught between, where
they seem to be heading, and what keeps returning.

Rules:
- Use the person's own register. Short, plain phrases, not clinical language.
- Never quote a sentence back verbatim. Name the thing, do not transcribe it.
- Omit anything you are not confident about. Fewer, truer entries beat coverage.
- If the conversation is too short or too slight to have structure, return empty
  arrays. That is a valid and useful answer.
- Never include names, places, employers, or any other identifying detail.`;

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
      distillation: { compass: [], map: [] },
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
