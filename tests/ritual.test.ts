import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { appendMessages, resumeOrStartSession } from "@/lib/echo/sessions";
import { InMemorySessionStore } from "@/lib/echo/store";
import { commitClosing, proposeClosing, abandonClosing, RitualError } from "@/lib/echo/ritual";
import { keepOnly, parseDistillation, type Distillation } from "@/lib/echo/schema";
import { FakeXTiles } from "@/lib/xtiles/fake";
import { XTilesWriteError } from "@/lib/xtiles/adapter";

/**
 * The closing ritual, with the recovery path as the centrepiece.
 *
 * "If the xTiles write fails, the session must NOT be destroyed." That sentence
 * is the reason this file exists — everything else here is supporting cast.
 */

const USER = "22222222-2222-4222-8222-222222222222";
const SECRET = "I have not told anyone that I already handed in my notice";

const DISTILLED: Distillation = {
  compass: [{ facet: "direction", label: "Already gone", note: "The decision is behind them." }],
  map: [{ kind: "pattern", label: "Deciding in private", note: "Announces, never consults." }],
};

vi.mock("@/lib/echo/distill", () => ({
  distill: vi.fn(async () => ({
    distillation: DISTILLED,
    metrics: {
      durationMs: 5,
      model: "claude-haiku-4-5",
      stopReason: "end_turn",
      errorClass: null,
      inputTokens: 100,
      outputTokens: 20,
      cacheReadInputTokens: null,
      cacheCreationInputTokens: null,
    },
  })),
  DistillationFailedError: class extends Error {},
}));

vi.mock("@/lib/echo/receipts", () => ({
  createReceipt: vi.fn(async () => {}),
  markWritten: vi.fn(async () => {}),
  markFailed: vi.fn(async () => {}),
}));

vi.mock("@/lib/echo/telemetry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/echo/telemetry")>();
  return { ...actual, recordTurn: vi.fn(async () => {}) };
});

beforeEach(() => {
  process.env.SESSION_MASTER_KEY = randomBytes(32).toString("base64");
});

async function conversation(store: InMemorySessionStore) {
  const opened = await resumeOrStartSession(store, USER);
  await appendMessages(store, opened.row, opened.transcript, { role: "user", content: SECRET });
  return opened.row.id;
}

describe("proposing", () => {
  it("marks the session closing so no more turns can land", async () => {
    const store = new InMemorySessionStore();
    const id = await conversation(store);

    await proposeClosing(store, USER);

    expect(store.peek(id)?.status).toBe("closing");
    expect(await store.findOpen(USER)).toBeNull();
  });

  it("resumes a ritual already under way rather than starting a second", async () => {
    const store = new InMemorySessionStore();
    const id = await conversation(store);

    const first = await proposeClosing(store, USER);
    const second = await proposeClosing(store, USER);

    expect(first.sessionId).toBe(id);
    expect(second.sessionId).toBe(id);
  });

  it("refuses when there is nothing open", async () => {
    const store = new InMemorySessionStore();
    await expect(proposeClosing(store, USER)).rejects.toThrow(RitualError);
  });
});

describe("changing your mind", () => {
  it("puts the conversation back, intact", async () => {
    const store = new InMemorySessionStore();
    const id = await conversation(store);

    await proposeClosing(store, USER);
    await abandonClosing(store, USER);

    expect(store.peek(id)?.status).toBe("open");
    expect((await store.findOpen(USER))?.id).toBe(id);
  });
});

describe("when the xTiles write fails", () => {
  it("does NOT destroy the session — this is the whole recovery path", async () => {
    const store = new InMemorySessionStore();
    const xtiles = new FakeXTiles();
    const id = await conversation(store);
    const proposal = await proposeClosing(store, USER);

    xtiles.failNextWrite = { reason: "upstream 503", retryable: true };

    await expect(
      commitClosing(store, xtiles, USER, id, ["compass-0"], proposal.distillation),
    ).rejects.toThrow(RitualError);

    // Every byte is still here.
    const row = store.peek(id);
    expect(row).toBeDefined();
    expect(row!.wrappedKey.some((byte) => byte !== 0)).toBe(true);
    expect(await store.find(id, USER)).not.toBeNull();
  });

  it("tells the person their conversation is safe, not that something broke", async () => {
    const store = new InMemorySessionStore();
    const xtiles = new FakeXTiles();
    const id = await conversation(store);
    const proposal = await proposeClosing(store, USER);

    xtiles.failNextWrite = { reason: "upstream 503", retryable: true };

    const error = await commitClosing(
      store,
      xtiles,
      USER,
      id,
      ["compass-0"],
      proposal.distillation,
    ).catch((e: RitualError) => e);

    expect(error).toBeInstanceOf(RitualError);
    expect((error as RitualError).message).toMatch(/haven't ended the conversation/i);
    expect((error as RitualError).retryable).toBe(true);
  });

  it("succeeds on retry, and writes exactly once", async () => {
    const store = new InMemorySessionStore();
    const xtiles = new FakeXTiles();
    const id = await conversation(store);
    const proposal = await proposeClosing(store, USER);

    xtiles.failNextWrite = { reason: "upstream 503", retryable: true };
    await commitClosing(store, xtiles, USER, id, ["compass-0"], proposal.distillation).catch(
      () => {},
    );

    // The retry goes through.
    await commitClosing(store, xtiles, USER, id, ["compass-0"], proposal.distillation);

    expect(store.peek(id)).toBeUndefined();
    const workspace = await xtiles.readExisting(USER);
    expect(workspace.compass).toHaveLength(1);
  });

  it("does not destroy the session when xTiles is not connected", async () => {
    const store = new InMemorySessionStore();
    const notConnected = new FakeXTiles();
    vi.spyOn(notConnected, "isConnected").mockResolvedValue(false);

    const id = await conversation(store);
    const proposal = await proposeClosing(store, USER);

    await expect(
      commitClosing(store, notConnected, USER, id, ["compass-0"], proposal.distillation),
    ).rejects.toThrow(/isn't connected/i);

    expect(store.peek(id)).toBeDefined();
  });
});

describe("idempotency", () => {
  it("a repeated write under one key does not duplicate someone's Compass", async () => {
    const xtiles = new FakeXTiles();
    const first = await xtiles.write(USER, DISTILLED, "key-1");
    const second = await xtiles.write(USER, DISTILLED, "key-1");

    expect(second.ref).toBe(first.ref);
    const workspace = await xtiles.readExisting(USER);
    expect(workspace.compass).toHaveLength(1);
    expect(workspace.map).toHaveLength(1);
  });
});

describe("the schema seam", () => {
  it("keeps exactly the entries chosen, by stable id", () => {
    const kept = keepOnly(DISTILLED, ["map-0"]);
    expect(kept.compass).toHaveLength(0);
    expect(kept.map).toHaveLength(1);
  });

  it("rejects a distillation with the wrong shape rather than storing it", () => {
    expect(() => parseDistillation({ compass: [], map: [{ kind: "nope", label: "x", note: "" }] }))
      .toThrow(/Map entry 0/);
    expect(() => parseDistillation({ compass: [] })).toThrow(/no map array/);
    expect(() => parseDistillation("a paragraph of prose")).toThrow(/not an object/);
  });

  it("never quotes the offending value in the error, since it came from a conversation", () => {
    const error = (() => {
      try {
        parseDistillation({ compass: [{ facet: "value", label: "", note: "SECRET TEXT" }], map: [] });
      } catch (e) {
        return e as Error;
      }
    })();
    expect(error?.message).not.toContain("SECRET TEXT");
  });
});

describe("XTilesWriteError", () => {
  it("carries whether retrying is worth it", () => {
    expect(new XTilesWriteError("401", false).retryable).toBe(false);
    expect(new XTilesWriteError("503", true).retryable).toBe(true);
  });
});
