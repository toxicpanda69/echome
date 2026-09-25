import "server-only";

import { assertLocalMode } from "@/lib/local/mode";
import type { DistillResult } from "@/lib/echo/distill";
import type { Distillation } from "@/lib/echo/schema";
import type { Transcript } from "@/lib/echo/transcript";

/**
 * A stand-in for the distiller, used only in local mode with no API key.
 *
 * It exists so the closing ritual — the choosing, the xTiles write, the retry
 * path, the destruction — can be walked through end to end with no credentials.
 * It produces entries in the right SHAPE from what was actually said, so the
 * interface has real content to render, but it is not doing any real analysis
 * and does not pretend to.
 *
 * Every entry it produces is labelled, and the model is recorded as
 * "local-stub" in telemetry, so no distillation made here can be mistaken for
 * a real one.
 */

export const STUB_MODEL = "local-stub";

function theirWords(transcript: Transcript): string[] {
  return transcript.messages
    .filter((message) => message.role === "user")
    .map((message) =>
      typeof message.content === "string"
        ? message.content
        : message.content
            .filter((block) => block.type === "text")
            .map((block) => (block as { text: string }).text)
            .join(" "),
    )
    .filter((text) => text.trim().length > 0);
}

/**
 * A description of the SIZE and SHAPE of what was said, never its content.
 *
 * The first version of this echoed their opening words, and the erasure audit
 * caught it: a kept entry carried a verbatim fragment of the conversation into
 * the xTiles workspace. The real distiller is instructed never to transcribe
 * (apart from one optional sentence), so the stub must not either — otherwise
 * it models the wrong behaviour and makes the audit useless.
 */
function shapeOf(said: string[]): string {
  const turns = said.length;
  const words = said.reduce((total, text) => total + text.trim().split(/\s+/).length, 0);
  return `${turns} ${turns === 1 ? "message" : "messages"}, ${words} words`;
}

const STUB_NOTE =
  "Placeholder from the local stub. No analysis was performed, and nothing they wrote is reproduced here.";

export async function distillLocally(transcript: Transcript): Promise<DistillResult> {
  assertLocalMode();

  const said = theirWords(transcript);
  const fuller = said.length >= 2;

  // The shape of a real entry: a brief conversation earns a Theme and a Light,
  // a fuller one adds a Moment and Where we left off. Same rule as the skill.
  const distillation: Distillation = {
    entry:
      said.length === 0
        ? null
        : {
            title: "Local Stub Entry",
            theme: `${shapeOf(said)}. ${STUB_NOTE}`,
            moment: fuller ? `A placeholder moment. ${STUB_NOTE}` : "",
            leftOff: fuller ? `A placeholder for what felt unfinished. ${STUB_NOTE}` : "",
            pattern: "",
            sentence: "",
            light: "A placeholder light to leave on. The real one is written from what was said.",
            thread: "",
          },
  };

  return {
    distillation,
    metrics: {
      durationMs: 0,
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
