import type Anthropic from "@anthropic-ai/sdk";

/**
 * The in-memory shape of a conversation, and the only thing that ever gets
 * encrypted into live_sessions.encrypted_payload.
 *
 * Messages are stored as the SDK's own MessageParam, including assistant
 * thinking blocks with their signatures, so a resumed session replays back to
 * the API byte-identically to how it came out.
 */

export const TRANSCRIPT_VERSION = 1;

export interface Transcript {
  readonly v: number;
  readonly messages: Anthropic.MessageParam[];
}

export function emptyTranscript(): Transcript {
  return { v: TRANSCRIPT_VERSION, messages: [] };
}

export class TranscriptFormatError extends Error {
  override readonly name = "TranscriptFormatError";
}

export function serialiseTranscript(transcript: Transcript): string {
  return JSON.stringify(transcript);
}

/**
 * Parse a decrypted payload. Validates shape only — never inspects, logs or
 * reports message content, and the error carries none of it.
 */
export function deserialiseTranscript(plaintext: string): Transcript {
  let parsed: unknown;
  try {
    parsed = JSON.parse(plaintext);
  } catch {
    throw new TranscriptFormatError("Session payload is not valid JSON.");
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new TranscriptFormatError("Session payload is not an object.");
  }
  const candidate = parsed as { v?: unknown; messages?: unknown };
  if (candidate.v !== TRANSCRIPT_VERSION) {
    throw new TranscriptFormatError(`Unsupported transcript version: ${String(candidate.v)}`);
  }
  if (!Array.isArray(candidate.messages)) {
    throw new TranscriptFormatError("Session payload has no message array.");
  }
  return { v: TRANSCRIPT_VERSION, messages: candidate.messages as Anthropic.MessageParam[] };
}

export function withMessages(
  transcript: Transcript,
  ...added: Anthropic.MessageParam[]
): Transcript {
  return { v: TRANSCRIPT_VERSION, messages: [...transcript.messages, ...added] };
}

/** What the browser needs to render a resumed conversation. */
export interface DisplayTurn {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly text: string;
}

/**
 * Flatten a transcript for display. Thinking and redacted_thinking blocks are
 * dropped: they are kept in history for the API's benefit, never shown.
 */
export function toDisplayTurns(transcript: Transcript): DisplayTurn[] {
  const turns: DisplayTurn[] = [];
  transcript.messages.forEach((message, index) => {
    const text =
      typeof message.content === "string"
        ? message.content
        : message.content
            .filter((block) => block.type === "text")
            .map((block) => (block as Anthropic.TextBlockParam).text)
            .join("");
    if (text.length === 0) return;
    turns.push({ id: `turn-${index}`, role: message.role, text });
  });
  return turns;
}
