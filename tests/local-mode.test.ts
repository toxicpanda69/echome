import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Local mode is a development auth bypass, which makes it the most dangerous
 * code in the repository. These tests exist to prove it cannot run anywhere it
 * should not — they are the reason the feature is allowed to exist at all.
 *
 * Each case re-imports the module with a fresh registry, because the guard runs
 * once at import time by design.
 */

const ENV = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  // Vitest sets NODE_ENV to "test"; start each case from a clean slate.
  for (const key of ["ECHOME_LOCAL_MODE", "VERCEL", "VERCEL_ENV"]) delete process.env[key];
});

afterEach(() => {
  process.env = { ...ENV };
});

async function importMode() {
  return import("@/lib/local/mode");
}

describe("the production guard", () => {
  it("refuses to load when NODE_ENV is production", async () => {
    process.env.ECHOME_LOCAL_MODE = "1";
    vi.stubEnv("NODE_ENV", "production");
    await expect(importMode()).rejects.toThrow(/refuses to run here/);
    vi.unstubAllEnvs();
  });

  it("refuses to load on Vercel", async () => {
    process.env.ECHOME_LOCAL_MODE = "1";
    process.env.VERCEL = "1";
    await expect(importMode()).rejects.toThrow(/running on Vercel/);
  });

  it("refuses to load on a Vercel preview deployment", async () => {
    process.env.ECHOME_LOCAL_MODE = "1";
    process.env.VERCEL_ENV = "preview";
    await expect(importMode()).rejects.toThrow(/VERCEL_ENV is preview/);
  });

  it("names every reason at once rather than the first it finds", async () => {
    process.env.ECHOME_LOCAL_MODE = "1";
    process.env.VERCEL = "1";
    process.env.VERCEL_ENV = "production";
    vi.stubEnv("NODE_ENV", "production");
    await expect(importMode()).rejects.toThrow(/NODE_ENV.*Vercel.*VERCEL_ENV/s);
    vi.unstubAllEnvs();
  });
});

describe("when the flag is absent", () => {
  it("stays off, and off is the default", async () => {
    const { LOCAL_MODE } = await importMode();
    expect(LOCAL_MODE).toBe(false);
  });

  it("is not enabled by any value other than exactly \"1\"", async () => {
    for (const value of ["true", "yes", "0", "", "TRUE", "on"]) {
      vi.resetModules();
      process.env.ECHOME_LOCAL_MODE = value;
      const { LOCAL_MODE } = await importMode();
      expect(LOCAL_MODE, `ECHOME_LOCAL_MODE=${value}`).toBe(false);
    }
  });

  it("makes local-only code throw if it is somehow reached", async () => {
    const { assertLocalMode } = await importMode();
    expect(() => assertLocalMode()).toThrow(/without ECHOME_LOCAL_MODE=1/);
  });

  it("refuses to construct the local session store", async () => {
    const { LocalFileSessionStore } = await import("@/lib/local/store");
    expect(() => new LocalFileSessionStore()).toThrow(/without ECHOME_LOCAL_MODE=1/);
  });

  it("refuses to run the stub responder", async () => {
    const { speakLocally } = await import("@/lib/local/voice");
    await expect(async () => {
      for await (const _ of speakLocally([{ role: "user", content: "hello" }])) {
        // The guard throws on the first pull, before anything is yielded.
      }
    }).rejects.toThrow(/without ECHOME_LOCAL_MODE=1/);
  });
});

describe("the local-only inspection endpoint", () => {
  it("is a 404 when local mode is off", async () => {
    // It returns a decrypted transcript over HTTP. That is acceptable for a
    // console talking to your own machine and must not exist anywhere else.
    const { GET } = await import("@/app/api/local/session/route");
    const response = await GET();
    expect(response.status).toBe(404);
  });

  it("writes nothing that could hold user text", async () => {
    process.env.ECHOME_LOCAL_MODE = "1";
    const { recordTurnLocally } = await import("@/lib/local/telemetry-sink");
    const { mkdtempSync, readFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");

    // The sink writes relative to cwd, so run it somewhere disposable.
    const previous = process.cwd();
    const scratch = mkdtempSync(join(tmpdir(), "echome-telemetry-"));
    process.chdir(scratch);

    try {
      recordTurnLocally("session-1", {
        durationMs: 1200,
        model: "claude-opus-5",
        stopReason: "end_turn",
        errorClass: null,
        inputTokens: 900,
        outputTokens: 40,
        cacheReadInputTokens: 850,
        cacheCreationInputTokens: 0,
      });

      const line = readFileSync(join(scratch, ".echome-local", "telemetry.jsonl"), "utf8").trim();
      const entry = JSON.parse(line) as Record<string, unknown>;

      // Every field is a number, a short label, or an id. If a field ever
      // appears here that is not on this list, it needs justifying.
      expect(Object.keys(entry).sort()).toEqual([
        "at",
        "cacheCreationInputTokens",
        "cacheReadInputTokens",
        "durationMs",
        "errorClass",
        "inputTokens",
        "model",
        "outputTokens",
        "sessionId",
        "stopReason",
      ]);
    } finally {
      process.chdir(previous);
    }
  });
});

describe("when it is on", () => {
  beforeEach(() => {
    process.env.ECHOME_LOCAL_MODE = "1";
  });

  it("turns on", async () => {
    const { LOCAL_MODE } = await importMode();
    expect(LOCAL_MODE).toBe(true);
  });

  it("gives an address the same user id every time, so sessions survive", async () => {
    const { localUserId } = await import("@/lib/local/auth");
    const first = localUserId("someone@example.com");
    expect(localUserId("someone@example.com")).toBe(first);
    expect(localUserId("SOMEONE@Example.com ")).toBe(first);
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("gives different addresses different user ids, so they cannot see each other", async () => {
    const { localUserId } = await import("@/lib/local/auth");
    expect(localUserId("a@example.com")).not.toBe(localUserId("b@example.com"));
  });

  it("labels stub turns so they cannot be mistaken for real ones", async () => {
    const { speakLocally, STUB_MODEL } = await import("@/lib/local/voice");
    const events = [];
    for await (const event of speakLocally([{ role: "user", content: "I am tired" }])) {
      events.push(event);
    }

    const done = events.at(-1)!;
    expect(done.type).toBe("done");
    if (done.type !== "done") throw new Error("unreachable");
    expect(done.metrics.model).toBe(STUB_MODEL);
    expect(done.metrics.inputTokens).toBeNull();

    // It streams in pieces rather than one lump, so the client's reader is
    // genuinely under test.
    expect(events.filter((e) => e.type === "text").length).toBeGreaterThan(5);
  });
});
