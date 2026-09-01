import "server-only";

import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { LOCAL_MODE } from "@/lib/local/mode";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Distillation receipts.
 *
 * A receipt records that a conversation reached the closing ritual, how many
 * things were drawn out, how many the person kept, and where it was written.
 * It never holds the distilled content — that lives in the person's own xTiles
 * — and it never holds conversation text.
 *
 * Dispatches the same way telemetry does, so the ritual works in local mode.
 */

export type ReceiptState = "pending" | "written" | "failed";

export interface Receipt {
  readonly id: string;
  readonly userId: string;
  readonly sessionId: string;
  readonly compassItems: number;
  readonly mapItems: number;
  readonly keptItems: number;
  readonly state: ReceiptState;
  readonly xtilesRef: string | null;
  readonly attempts: number;
  /** An error CLASS only. Never a body — those can echo the request. */
  readonly lastError: string | null;
  readonly createdAt: string;
}

export interface NewReceipt {
  readonly id: string;
  readonly userId: string;
  readonly sessionId: string;
  readonly compassItems: number;
  readonly mapItems: number;
  readonly keptItems: number;
}

function localPath(): string {
  return join(process.cwd(), ".echome-local", "receipts.jsonl");
}

function appendLocal(entry: Record<string, unknown>): void {
  mkdirSync(join(process.cwd(), ".echome-local"), { recursive: true });
  appendFileSync(localPath(), `${JSON.stringify(entry)}\n`, "utf8");
}

function readLocal(): Record<string, unknown>[] {
  try {
    return readFileSync(localPath(), "utf8")
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
  } catch {
    return [];
  }
}

export async function createReceipt(receipt: NewReceipt): Promise<void> {
  if (LOCAL_MODE) {
    appendLocal({ ...receipt, state: "pending", at: new Date().toISOString() });
    return;
  }

  const { error } = await createAdminClient().from("distillations").insert({
    id: receipt.id,
    user_id: receipt.userId,
    session_id: receipt.sessionId,
    compass_items: receipt.compassItems,
    map_items: receipt.mapItems,
    kept_items: receipt.keptItems,
    state: "pending",
  });
  if (error) throw error;
}

export async function markWritten(id: string, xtilesRef: string | null): Promise<void> {
  if (LOCAL_MODE) {
    appendLocal({ id, state: "written", xtilesRef, at: new Date().toISOString() });
    return;
  }
  const { error } = await createAdminClient()
    .from("distillations")
    .update({ state: "written", xtiles_ref: xtilesRef })
    .eq("id", id);
  if (error) throw error;
}

export async function markFailed(id: string, errorClass: string): Promise<void> {
  if (LOCAL_MODE) {
    appendLocal({ id, state: "failed", lastError: errorClass, at: new Date().toISOString() });
    return;
  }

  const db = createAdminClient();
  const { data } = await db
    .from("distillations")
    .select("attempts")
    .eq("id", id)
    .maybeSingle<{ attempts: number }>();

  const { error } = await db
    .from("distillations")
    .update({ state: "failed", last_error: errorClass, attempts: (data?.attempts ?? 0) + 1 })
    .eq("id", id);
  if (error) throw error;
}

/** How many conversations this person has closed. Used by the admin list. */
export async function countClosed(userId: string): Promise<number> {
  if (LOCAL_MODE) {
    return readLocal().filter((r) => r.userId === userId && r.state === "pending").length;
  }
  const { count, error } = await createAdminClient()
    .from("distillations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("state", "written");
  if (error) throw error;
  return count ?? 0;
}
