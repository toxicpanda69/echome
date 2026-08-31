import "server-only";

import { assertLocalMode } from "@/lib/local/mode";
import type { VoiceEvent } from "@/lib/echo/voice";
import type Anthropic from "@anthropic-ai/sdk";

/**
 * A stand-in for Claude, used only in local mode and only when there is no
 * ANTHROPIC_API_KEY. It exists so the conversation UI — streaming, persistence,
 * resume, the lot — can be exercised with no credentials at all.
 *
 * It is not clever and is not trying to be. Its job is to emit text a token at
 * a time so the streaming path is genuinely under test rather than simulated.
 * If you set a real API key, this is never reached.
 *
 * Telemetry records the model as "local-stub", so no turn produced here can be
 * mistaken for a real one later.
 */

export const STUB_MODEL = "local-stub";

const OPENERS = [
  "Let me say back what I heard.",
  "There's something in the way you put that.",
  "I want to slow down on one part of that.",
];

const CLOSERS = [
  "What sits underneath that, if you stay with it a moment?",
  "Which part of that would you least like to be true?",
  "What would change if that were not a problem to solve?",
];

function pick(options: readonly string[], seed: number): string {
  return options[seed % options.length]!;
}

/** A short excerpt of what they said, so the reply is visibly responsive. */
function echoOf(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  return trimmed.length <= 90 ? trimmed : `${trimmed.slice(0, 90).trimEnd()}…`;
}

export async function* speakLocally(
  messages: Anthropic.Beta.BetaMessageParam[],
): AsyncGenerator<VoiceEvent> {
  assertLocalMode();
  const startedAt = performance.now();

  const last = messages.at(-1);
  const said =
    typeof last?.content === "string"
      ? last.content
      : (last?.content ?? [])
          .filter((block) => block.type === "text")
          .map((block) => (block as Anthropic.Beta.BetaTextBlockParam).text)
          .join(" ");

  const turn = messages.length;
  const reply =
    `${pick(OPENERS, turn)} You said: "${echoOf(said)}"\n\n` +
    `${pick(CLOSERS, turn)}\n\n` +
    "(This reply is generated locally, without calling Claude. Set ANTHROPIC_API_KEY to hear the real thing.)";

  // Word by word, with a small delay, so the client's streaming reader is doing
  // real work rather than receiving one lump.
  const chunks = reply.match(/\S+\s*/g) ?? [reply];
  for (const chunk of chunks) {
    await new Promise((resolve) => setTimeout(resolve, 18));
    yield { type: "text", text: chunk };
  }

  yield {
    type: "done",
    assistantMessage: { role: "assistant", content: [{ type: "text", text: reply }] },
    metrics: {
      durationMs: performance.now() - startedAt,
      model: STUB_MODEL,
      stopReason: "end_turn",
      errorClass: null,
      inputTokens: null,
      outputTokens: null,
      cacheReadInputTokens: null,
      cacheCreationInputTokens: null,
    },
  };
}
