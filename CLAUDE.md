# EchoMe

A private, logged-in web app where a person has a reflective conversation with Claude.
Continuity does not come from a stored chat log — it comes from a structured memory
pipeline that writes two views (EchoCompass, EchoMap) into the user's own xTiles workspace.

Client: Todd Savard (echomechat.ai). Built by Creative Mechanix.

---

## THE RULE THAT OVERRIDES EVERYTHING

**Conversation transcripts are never persisted in readable form.**

This is the product. It is not a preference, a nice-to-have, or something to optimise later.

- Never create a `messages`, `chat_history`, `conversations`, or `transcripts` table that
  stores plaintext message content.
- The in-flight transcript lives in ONE place: `live_sessions.payload`, encrypted with a
  key that belongs to that session alone.
- When a session closes, we destroy the key and delete the row. That is the erasure.
- Never log message content — not to stdout, not to Sentry, not to an analytics event,
  not in an error message, not in a debug branch, not "temporarily".
- Never add a "just for debugging" plaintext copy. If you think you need one, stop and ask.

If a task seems to require reading past conversation content, the answer is the distilled
Compass/Map record, not the transcript. If that genuinely doesn't work, stop and ask —
don't route around the rule.

---

## Stack (do not substitute without asking)

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) + TypeScript, deployed on Vercel |
| Database + auth | Supabase (Postgres, Supabase Auth, Row Level Security) |
| AI | Anthropic Claude API via `@anthropic-ai/sdk` |
| Payments | Stripe Checkout + Customer Portal + webhooks |
| Transactional email | Resend |
| Scheduled jobs | Vercel Cron |
| Errors | Sentry, with content scrubbing enabled |
| Styling | Tailwind CSS |

No LangChain, no vector DB, no Redis, no ORM beyond the Supabase client, no state
management library. Keep the dependency list short — this is a small team on a small budget.

---

## Claude API rules

**This codebase targets the 2026 Claude API. Patterns you remember from training are
likely stale. Follow these exactly.**

- Model IDs are complete as written. Never append a date suffix.
  - `claude-opus-5` — the conversation ($5 / $25 per million tokens in/out)
  - `claude-haiku-4-5` — distillation and safety classification ($1 / $5)
  - `claude-sonnet-5` — the middle option if we tune cost later ($2 / $10)
- `temperature`, `top_p`, `top_k` are **removed** on these models. Sending them returns 400.
- `budget_tokens` is **removed**. Use `thinking: { type: "adaptive" }` and control depth
  with `output_config: { effort: "low" | "medium" | "high" | "xhigh" | "max" }`.
- Assistant prefill (a trailing assistant message to steer format) returns 400. Use
  `output_config.format` or system prompt instructions instead.
- Do not set `thinking: { type: "disabled" }` on `claude-opus-5`. Use `effort: "low"` instead —
  disabling thinking causes the model to occasionally write tool calls into visible text.
- Always check `response.stop_reason === "refusal"` before reading `response.content`.
  On a refusal, `response.stop_details` carries the category. This matters here: EchoMe
  sits near emotionally sensitive material and refusals are a real path, not an edge case.
- On `claude-opus-5` requests, enable server-side fallbacks:
  `betas: ["server-side-fallback-2026-07-01"]` and `fallbacks: "default"`.
- Stream anything user-facing (`client.messages.stream(...)`, then `.finalMessage()`).
  Use `max_tokens` around 8000 for chat turns, 256 for classification.
- Structured output uses `output_config: { format: { ... } }` — the old `output_format`
  parameter is deprecated. Prefer `client.messages.parse()` where a schema is involved.
- Prompt caching: cache order is `tools` → `system` → `messages`. Put the frozen system
  prompt (Todd's skill file) first with `cache_control: { type: "ephemeral" }`, and never
  interpolate anything volatile (timestamps, request IDs, user names) into it. Verify it
  works by asserting `usage.cache_read_input_tokens > 0` on the second turn of a session.
- Use the SDK's own types (`Anthropic.MessageParam`, `Anthropic.Message`). Don't redefine them.
- Catch specific errors most-specific-first (`RateLimitError`, `APIStatusError`,
  `APIConnectionError`), not one broad `catch`.

---

## Conventions

- TypeScript strict mode. No `any` without a comment explaining why.
- Every table has Row Level Security on. A user can only ever read their own rows.
- Server-only secrets live in `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, `SESSION_MASTER_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY` — none of these may be referenced in a client component.
- Errors shown to a user say what happened and what to do next. No stack traces, no apologies.
- Telemetry is content-free: durations, token counts, error classes, output shape. Never text.
- Write the test for anything touching session encryption or key destruction.

## Out of scope (do not build unless asked)

Native mobile app, voice chat, PDF journal export, weekly summary emails, analytics
dashboards beyond the basic admin list. These are priced add-ons, not part of the build.
