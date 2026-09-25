import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { appendMessages, resumeOrStartSession } from "@/lib/echo/sessions";
import { InMemorySessionStore, type SessionRow } from "@/lib/echo/store";
import { commitClosing, proposeClosing } from "@/lib/echo/ritual";
import type { Distillation } from "@/lib/echo/schema";
import { FakeXTiles } from "@/lib/xtiles/fake";

/**
 * THE ERASURE AUDIT.
 *
 * From the Phase 4 brief: "Write and run a test that takes a full session
 * through the closing ritual, then greps the entire database, all logs, and
 * Sentry for any fragment of the conversation. It must come back empty. This is
 * the single most important test in the codebase."
 *
 * This is that test. It cannot reach a real Supabase instance from here, so it
 * audits every surface the application itself can write to:
 *
 *   - every byte the session store ever held
 *   - every byte the receipt writer produced
 *   - every telemetry record
 *   - everything written to stdout and stderr during the whole flow
 *   - what was handed to xTiles
 *
 * The distinctive phrases below are searched for in every one of those, in
 * several encodings. A single hit fails the build.
 */

const USER = "22222222-2222-4222-8222-222222222222";

/** Deliberately memorable, and the kind of thing this product exists to hear. */
const SAID = [
  "I have been pretending the marriage is fine since the miscarriage in March",
  "my brother would say I am running again and he would be right",
  "the promotion is the excuse I have been waiting for",
];

/** Every fragment that must not survive anywhere. */
const FORBIDDEN = [
  "miscarriage",
  "marriage is fine",
  "my brother",
  "running again",
  "promotion",
  "pretending",
];

const DISTILLED: Distillation = {
  entry: {
    title: "The Reasonable Exit",
    theme: "Leaving arrives before deciding, and a good reason turns up right on time.",
    moment: "",
    leftOff: "Wanting to be seen without having to explain.",
    pattern: "",
    sentence: "",
    light: "You do not have to explain yourself to be worth knowing.",
    thread: "",
  },
};

// The distiller and the receipt writer are stubbed so this test needs no API
// key and no database. What is NOT stubbed is anything that touches bytes.
vi.mock("@/lib/echo/distill", () => ({
  distill: vi.fn(async () => ({
    distillation: DISTILLED,
    metrics: {
      durationMs: 12,
      model: "claude-haiku-4-5",
      stopReason: "end_turn",
      errorClass: null,
      inputTokens: 900,
      outputTokens: 80,
      cacheReadInputTokens: null,
      cacheCreationInputTokens: null,
    },
  })),
  DistillationFailedError: class extends Error {},
}));

const receipts: Record<string, unknown>[] = [];
vi.mock("@/lib/echo/receipts", () => ({
  createReceipt: vi.fn(async (r: Record<string, unknown>) => void receipts.push({ ...r })),
  markWritten: vi.fn(async (id: string, ref: string | null) =>
    void receipts.push({ id, state: "written", ref }),
  ),
  markFailed: vi.fn(async (id: string, e: string) => void receipts.push({ id, state: "failed", e })),
}));

const telemetry: Record<string, unknown>[] = [];
vi.mock("@/lib/echo/telemetry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/echo/telemetry")>();
  return {
    ...actual,
    recordTurn: vi.fn(async (u: string, s: string, m: Record<string, unknown>) =>
      void telemetry.push({ u, s, ...m }),
    ),
  };
});

beforeEach(() => {
  process.env.SESSION_MASTER_KEY = randomBytes(32).toString("base64");
  receipts.length = 0;
  telemetry.length = 0;
});

/** Search a haystack for any forbidden fragment, in several encodings. */
function findLeaks(label: string, haystacks: readonly (string | Buffer)[]): string[] {
  const leaks: string[] = [];
  for (const haystack of haystacks) {
    const forms =
      typeof haystack === "string"
        ? [haystack.toLowerCase()]
        : ["utf8", "latin1", "ascii", "utf16le"].map((enc) =>
            haystack.toString(enc as BufferEncoding).toLowerCase(),
          );

    for (const phrase of FORBIDDEN) {
      if (forms.some((form) => form.includes(phrase.toLowerCase()))) {
        leaks.push(`${label}: "${phrase}"`);
      }
    }
  }
  return leaks;
}

describe("the erasure audit", () => {
  it("leaves no fragment of the conversation anywhere the app can write", async () => {
    const store = new InMemorySessionStore();
    const xtiles = new FakeXTiles();

    // Capture everything the process writes to its own output for the whole run.
    const output: string[] = [];
    const spies = (["log", "warn", "error", "info", "debug"] as const).map((level) =>
      vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
        output.push(args.map(String).join(" "));
      }),
    );

    // Every version of the row the store ever held, not just the final one.
    const allRowStates: SessionRow[] = [];

    try {
      const opened = await resumeOrStartSession(store, USER);
      let transcript = opened.transcript;

      for (const line of SAID) {
        transcript = await appendMessages(
          store,
          opened.row,
          transcript,
          { role: "user", content: line },
          { role: "assistant", content: [{ type: "text", text: "What sits underneath that?" }] },
        );
        const snapshot = store.peek(opened.row.id);
        if (snapshot) allRowStates.push({ ...snapshot });
      }

      const proposal = await proposeClosing(store, USER);
      const afterPropose = store.peek(opened.row.id);
      if (afterPropose) allRowStates.push({ ...afterPropose });

      await commitClosing(
        store,
        xtiles,
        USER,
        proposal.sessionId,
        ["entry-theme", "entry-leftOff", "entry-light"],
        proposal.distillation,
      );

      // The row is gone.
      expect(store.peek(proposal.sessionId)).toBeUndefined();
      expect(await store.findOpen(USER)).toBeNull();
      expect(await store.findClosing(USER)).toBeNull();
    } finally {
      for (const spy of spies) spy.mockRestore();
    }

    const leaks = [
      ...findLeaks(
        "session store",
        allRowStates.flatMap((row) => [row.encryptedPayload, row.wrappedKey, row.nonce]),
      ),
      ...findLeaks("session store (json)", [JSON.stringify(allRowStates)]),
      ...findLeaks("receipts", [JSON.stringify(receipts)]),
      ...findLeaks("telemetry", [JSON.stringify(telemetry)]),
      ...findLeaks("console output", output),
      ...findLeaks("xtiles workspace", [JSON.stringify(await xtiles.readExisting(USER))]),
    ];

    expect(leaks).toEqual([]);
  });

  it("keeps only what the person chose, and nothing else, in xTiles", async () => {
    const store = new InMemorySessionStore();
    const xtiles = new FakeXTiles();

    const opened = await resumeOrStartSession(store, USER);
    await appendMessages(store, opened.row, opened.transcript, {
      role: "user",
      content: SAID[0]!,
    });

    const proposal = await proposeClosing(store, USER);
    // Three fields were drawn out; they keep one.
    await commitClosing(store, xtiles, USER, proposal.sessionId, ["entry-theme"], proposal.distillation);

    const workspace = await xtiles.readExisting(USER);
    expect(workspace).toHaveLength(1);
    expect(workspace[0]!.markdown).toContain("**Theme:** Leaving arrives before deciding");
    // What they did not tick is not on the page.
    expect(workspace[0]!.markdown).not.toContain("Wanting to be seen");
    expect(workspace[0]!.markdown).not.toContain("A light to leave on");
  });

  it("destroys the conversation even when the person keeps nothing", async () => {
    const store = new InMemorySessionStore();
    const xtiles = new FakeXTiles();

    const opened = await resumeOrStartSession(store, USER);
    await appendMessages(store, opened.row, opened.transcript, {
      role: "user",
      content: SAID[1]!,
    });

    const proposal = await proposeClosing(store, USER);
    const result = await commitClosing(store, xtiles, USER, proposal.sessionId, [], proposal.distillation);

    expect(result.kept).toBe(0);
    expect(result.ref).toBeNull();
    expect(store.peek(proposal.sessionId)).toBeUndefined();
    // Nothing was written to the workspace either.
    expect(await xtiles.readExisting(USER)).toEqual([]);
  });
});
