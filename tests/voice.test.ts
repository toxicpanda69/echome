import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * voice.ts against a mocked SDK. Proves the three things about this module that
 * would be expensive to discover in production: that the request is shaped the
 * way the 2026 API requires, that a refusal never leaks model content, and that
 * thinking never reaches the user.
 */

const mock = vi.hoisted(() => ({
  lastBody: null as Record<string, unknown> | null,
  events: [] as unknown[],
  final: null as unknown,
  throws: null as Error | null,
}));

vi.mock("@anthropic-ai/sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@anthropic-ai/sdk")>();
  class MockAnthropic {
    beta = {
      messages: {
        stream(body: Record<string, unknown>) {
          mock.lastBody = body;
          return {
            async *[Symbol.asyncIterator]() {
              if (mock.throws) throw mock.throws;
              for (const event of mock.events) yield event;
            },
            async finalMessage() {
              if (mock.throws) throw mock.throws;
              return mock.final;
            },
          };
        },
      },
    };
  }
  // Keep the real error classes: classifyError relies on instanceof.
  return { ...actual, default: MockAnthropic };
});

const { speak, systemPrompt, MODEL } = await import("@/lib/echo/voice");
const { REFUSAL } = await import("@/lib/echo/messages");

const textDelta = (text: string) => ({
  type: "content_block_delta",
  delta: { type: "text_delta", text },
});

const thinkingDelta = (thinking: string) => ({
  type: "content_block_delta",
  delta: { type: "thinking_delta", thinking },
});

function finalMessage(overrides: Record<string, unknown> = {}) {
  return {
    model: MODEL,
    stop_reason: "end_turn",
    content: [{ type: "text", text: "What would ordinary have to mean?" }],
    usage: {
      input_tokens: 1200,
      output_tokens: 42,
      cache_read_input_tokens: 980,
      cache_creation_input_tokens: 0,
    },
    ...overrides,
  };
}

async function collect(messages: Parameters<typeof speak>[0]) {
  const events = [];
  for await (const event of speak(messages)) events.push(event);
  return events;
}

const HELLO = [{ role: "user" as const, content: "hello" }];

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  mock.lastBody = null;
  mock.events = [];
  mock.final = null;
  mock.throws = null;
});

describe("request shape", () => {
  it("sends what the 2026 API expects and nothing it rejects", async () => {
    mock.events = [textDelta("hi")];
    mock.final = finalMessage();
    await collect(HELLO);

    const body = mock.lastBody!;
    expect(body.model).toBe("claude-opus-5");
    expect(body.max_tokens).toBe(8000);
    expect(body.thinking).toEqual({ type: "adaptive" });
    expect(body.output_config).toEqual({ effort: "low" });
    expect(body.betas).toEqual(["server-side-fallback-2026-07-01"]);
    expect(body.fallbacks).toBe("default");

    // Removed on this model — sending any of them is a 400.
    expect(body).not.toHaveProperty("temperature");
    expect(body).not.toHaveProperty("top_p");
    expect(body).not.toHaveProperty("top_k");
    // Removed in favour of output_config.effort.
    expect(body.thinking).not.toHaveProperty("budget_tokens");
  });

  it("puts the skill file first, as one cached block", async () => {
    mock.events = [];
    mock.final = finalMessage();
    await collect(HELLO);

    expect(mock.lastBody!.system).toEqual([
      { type: "text", text: systemPrompt(), cache_control: { type: "ephemeral" } },
    ]);
  });

  it("keeps the system prompt byte-stable between turns, or caching never hits", async () => {
    mock.final = finalMessage();
    await collect(HELLO);
    const first = mock.lastBody!.system;
    await collect([...HELLO, { role: "assistant", content: "hi" }, { role: "user", content: "more" }]);
    expect(mock.lastBody!.system).toEqual(first);
  });
});

describe("streaming", () => {
  it("emits text and never emits thinking", async () => {
    mock.events = [
      thinkingDelta("they are circling the same point"),
      textDelta("What would "),
      thinkingDelta("do not say that"),
      textDelta("ordinary have to mean?"),
    ];
    mock.final = finalMessage();

    const events = await collect(HELLO);
    const text = events.filter((e) => e.type === "text").map((e) => e.text);

    expect(text.join("")).toBe("What would ordinary have to mean?");
    expect(text.join("")).not.toContain("circling");
    expect(JSON.stringify(events)).not.toContain("do not say that");
  });

  it("reports token counts including cache reads", async () => {
    mock.events = [textDelta("ok")];
    mock.final = finalMessage();

    const done = (await collect(HELLO)).at(-1)!;
    expect(done.type).toBe("done");
    if (done.type !== "done") throw new Error("unreachable");
    expect(done.metrics.inputTokens).toBe(1200);
    expect(done.metrics.cacheReadInputTokens).toBe(980);
    expect(done.metrics.stopReason).toBe("end_turn");
    expect(done.metrics.errorClass).toBeNull();
    expect(done.metrics.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("persists assistant content blocks whole, so thinking signatures survive", async () => {
    mock.events = [textDelta("ok")];
    mock.final = finalMessage({
      content: [
        { type: "thinking", thinking: "private", signature: "sig-abc" },
        { type: "text", text: "ok" },
      ],
    });

    const done = (await collect(HELLO)).at(-1)!;
    if (done.type !== "done") throw new Error("unreachable");
    expect(done.assistantMessage).toEqual({
      role: "assistant",
      content: [
        { type: "thinking", thinking: "private", signature: "sig-abc" },
        { type: "text", text: "ok" },
      ],
    });
  });
});

describe("refusal", () => {
  it("shows our calm wording and never reads the model's content", async () => {
    mock.events = [textDelta("I can't")];
    mock.final = finalMessage({
      stop_reason: "refusal",
      content: [{ type: "text", text: "MODEL CONTENT THAT MUST NOT BE READ" }],
      stop_details: { type: "refusal", reason: "policy" },
    });

    const events = await collect(HELLO);
    const refusal = events.find((e) => e.type === "refusal");
    expect(refusal).toBeDefined();
    if (refusal?.type !== "refusal") throw new Error("unreachable");
    expect(refusal.text).toBe(REFUSAL);

    // The model's post-refusal content never appears in any emitted event.
    expect(JSON.stringify(events)).not.toContain("MUST NOT BE READ");

    // History still alternates: an assistant turn exists, in our words.
    const done = events.at(-1)!;
    if (done.type !== "done") throw new Error("unreachable");
    expect(done.assistantMessage).toEqual({
      role: "assistant",
      content: [{ type: "text", text: REFUSAL }],
    });
    expect(done.metrics.stopReason).toBe("refusal");
  });
});

describe("failure", () => {
  it("returns an error event rather than throwing at the caller", async () => {
    mock.throws = new TypeError("upstream exploded");

    const events = await collect(HELLO);
    const last = events.at(-1)!;
    expect(last.type).toBe("error");
    if (last.type !== "error") throw new Error("unreachable");
    expect(last.metrics.errorClass).toBe("TypeError");
    expect(last.metrics.model).toBe(MODEL);
  });
});
