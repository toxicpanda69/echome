import "server-only";

import {
  APIConnectionError,
  APIError,
  APIUserAbortError,
  AuthenticationError,
  RateLimitError,
} from "@anthropic-ai/sdk";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Content-free telemetry.
 *
 * We cannot debug EchoMe by reading conversations — that is the whole point of
 * the product — so this is the only operational visibility that will ever
 * exist. Which makes it worth being disciplined about.
 *
 * The rule for this file: every field is a number, an enum-ish string, or an
 * identifier. If you are ever tempted to add a field that could hold a fragment
 * of what a user wrote — a prompt excerpt, a "sample", an error body from the
 * API that might quote the input — stop. That is the line.
 */

export interface TurnMetrics {
  readonly durationMs: number;
  readonly model: string | null;
  readonly stopReason: string | null;
  /** Constructor name only. Never a message, never a body. */
  readonly errorClass: string | null;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly cacheReadInputTokens: number | null;
  readonly cacheCreationInputTokens: number | null;
}

export function emptyMetrics(durationMs: number): TurnMetrics {
  return {
    durationMs,
    model: null,
    stopReason: null,
    errorClass: null,
    inputTokens: null,
    outputTokens: null,
    cacheReadInputTokens: null,
    cacheCreationInputTokens: null,
  };
}

/**
 * Reduce an error to a single safe label.
 *
 * Deliberately does NOT read error.message. Upstream error bodies can echo the
 * request back, and the request contains the conversation.
 */
export function classifyError(error: unknown): string {
  // Most specific first. The status suffix on the generic APIError branch is
  // what tells a 529 overload apart from a 400 we caused.
  if (error instanceof RateLimitError) return "RateLimitError";
  if (error instanceof AuthenticationError) return "AuthenticationError";
  if (error instanceof APIUserAbortError) return "APIUserAbortError";
  if (error instanceof APIConnectionError) return "APIConnectionError";
  if (error instanceof APIError) return `APIError:${error.status ?? "unknown"}`;
  if (error instanceof Error) return error.name || "Error";
  return "UnknownError";
}

/**
 * Persist one turn's metrics. Never throws — telemetry failing must not cost a
 * user their reply. A write failure is reported by class only.
 */
export async function recordTurn(
  userId: string,
  sessionId: string,
  metrics: TurnMetrics,
): Promise<void> {
  try {
    const { error } = await createAdminClient().from("turn_telemetry").insert({
      user_id: userId,
      session_id: sessionId,
      duration_ms: Math.round(metrics.durationMs),
      model: metrics.model,
      stop_reason: metrics.stopReason,
      error_class: metrics.errorClass,
      input_tokens: metrics.inputTokens,
      output_tokens: metrics.outputTokens,
      cache_read_input_tokens: metrics.cacheReadInputTokens,
      cache_creation_input_tokens: metrics.cacheCreationInputTokens,
    });
    if (error) console.warn(`[telemetry] insert failed: ${error.code ?? "unknown"}`);
  } catch (error) {
    console.warn(`[telemetry] insert threw: ${classifyError(error)}`);
  }
}
