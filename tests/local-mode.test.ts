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
