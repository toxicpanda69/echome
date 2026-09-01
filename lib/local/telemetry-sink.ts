import "server-only";

import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { assertLocalMode, LOCAL_DATA_DIR } from "@/lib/local/mode";
import type { TurnMetrics } from "@/lib/echo/telemetry";

/**
 * Local-mode telemetry sink.
 *
 * Without this, local mode loses telemetry entirely — recordTurn writes to a
 * Supabase table that does not exist here, fails, and warns into a log nobody
 * reads. Since telemetry is the only visibility this product will ever have,
 * being unable to see it while developing is the wrong trade.
 *
 * The content-free rule applies exactly as it does to the real table: numbers,
 * labels and identifiers only. There is no field here that can hold user text,
 * and adding one would be a bug.
 */

export interface LocalTelemetryEntry extends TurnMetrics {
  readonly at: string;
  readonly sessionId: string;
}

function filePath(): string {
  return join(process.cwd(), LOCAL_DATA_DIR, "telemetry.jsonl");
}

export function recordTurnLocally(sessionId: string, metrics: TurnMetrics): void {
  assertLocalMode();

  // Explicit field list rather than a spread, so a future field added to
  // TurnMetrics cannot silently start being written here.
  const entry: LocalTelemetryEntry = {
    at: new Date().toISOString(),
    sessionId,
    durationMs: Math.round(metrics.durationMs),
    model: metrics.model,
    stopReason: metrics.stopReason,
    errorClass: metrics.errorClass,
    inputTokens: metrics.inputTokens,
    outputTokens: metrics.outputTokens,
    cacheReadInputTokens: metrics.cacheReadInputTokens,
    cacheCreationInputTokens: metrics.cacheCreationInputTokens,
  };

  mkdirSync(join(process.cwd(), LOCAL_DATA_DIR), { recursive: true });
  appendFileSync(filePath(), `${JSON.stringify(entry)}\n`, "utf8");
}

/** Most recent first. Used by the local test console. */
export function readRecentTelemetry(limit = 20): LocalTelemetryEntry[] {
  assertLocalMode();
  try {
    return readFileSync(filePath(), "utf8")
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as LocalTelemetryEntry)
      .reverse()
      .slice(0, limit);
  } catch {
    return [];
  }
}
