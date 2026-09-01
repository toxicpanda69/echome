import "server-only";

import { assertLocalMode } from "@/lib/local/mode";
import type { DistillResult } from "@/lib/echo/distill";
import { COMPASS_FACETS, MAP_KINDS, type Distillation } from "@/lib/echo/schema";
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
 * A label that reflects the SIZE and SHAPE of what was said, never its content.
 *
 * The first version of this echoed their opening words, and the erasure audit
 * caught it: a kept entry carried a verbatim fragment of the conversation into
 * the xTiles workspace. The real distiller is instructed never to transcribe,
 * so the stub must not either — otherwise it models the wrong behaviour and
 * makes the audit useless.
 */
function shapeOf(text: string, index: number): string {
  const words = text.trim().split(/\s+/).length;
  const size = words < 12 ? "A short thing" : words < 40 ? "Something" : "A long thing";
  return `${size} they said (turn ${index + 1}, ${words} words)`;
}

export async function distillLocally(transcript: Transcript): Promise<DistillResult> {
  assertLocalMode();

  const said = theirWords(transcript);

  const distillation: Distillation = {
    compass: said.slice(0, 3).map((text, index) => ({
      facet: COMPASS_FACETS[index % COMPASS_FACETS.length]!,
      label: shapeOf(text, index),
      note: "Placeholder from the local stub. No analysis was performed, and " +
        "nothing they wrote is reproduced here.",
    })),
    map: said.slice(0, 2).map((text, index) => ({
      kind: MAP_KINDS[index % MAP_KINDS.length]!,
      label: shapeOf(text, index),
      note: "Placeholder from the local stub. No analysis was performed, and " +
        "nothing they wrote is reproduced here.",
    })),
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
