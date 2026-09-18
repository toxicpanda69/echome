# EchoMe — build prompts for Claude Code

How to use these:

1. Make an empty folder, `git init`, open Claude Code in it.
2. Save `echome-CLAUDE.md` into the repo root as `CLAUDE.md` **before you prompt anything.**
   It is the guardrail that stops Claude from building a normal chat app.
3. Paste Prompt 1. Let it plan, answer its questions, then let it build.
4. Move to the next prompt only when the previous phase actually runs.

Don't paste all four at once. Each phase is a few sessions of work, and a single
mega-prompt produces a plausible-looking app that doesn't hold together.

---

## Prompt 1 — Foundation and the conversation (Phase 1, September)

```
You're building the first phase of EchoMe, a reflective conversation web app.
Read CLAUDE.md first — the no-transcript rule in it constrains almost every
decision below, and it is not negotiable.

THE PRODUCT IN THREE SENTENCES
Someone signs up, logs in, and lands in a private conversation with Claude that
reflects their thinking back at them. A conversation is not a browser tab — it
lives on the server for days, survives closing the laptop, and ends only through
a deliberate "closing ritual" (built in Phase 2, not now). When it ends, the
transcript is destroyed and only distilled structure survives, in the user's own
xTiles workspace.

WHAT TO BUILD IN THIS PHASE
1. Next.js App Router project, TypeScript strict, Tailwind, deployed-ready for Vercel.
2. Supabase auth: email/password sign up, log in, log out, password reset. Leave a
   clean seam for Google OAuth later but don't wire it now.
3. A `profiles` table keyed to the Supabase auth user, with RLS so a user can only
   read their own row.
4. The live session store — the important part:
   - Table `live_sessions`: id, user_id, status ('open' | 'closing' | 'closed'),
     created_at, last_active_at, encrypted_payload (bytea), wrapped_key (bytea), nonce.
   - The transcript is serialised, encrypted with AES-256-GCM using a key generated
     per session, and that key is itself wrapped with SESSION_MASTER_KEY from env.
   - Nothing plaintext touches the database. Nothing touches localStorage.
   - Closing a session means: overwrite the wrapped key with zeroes, then delete the
     row. Write a test that proves a closed session's payload cannot be decrypted.
   - A user has at most one open session at a time. Reopening the app resumes it,
     on any device.
5. The chat interface: a clean, single-column, mobile-first conversation view.
   Streamed responses that render token by token. A visible but quiet disclaimer
   that EchoMe is not therapy. Style it neutrally for now — brand comes later.
6. The Claude integration, in one module, `lib/echo/voice.ts`:
   - Model `claude-opus-5`, streaming, `thinking: { type: "adaptive" }`,
     `output_config: { effort: "low" }`, `max_tokens: 8000`.
   - `betas: ["server-side-fallback-2026-07-01"]` with `fallbacks: "default"`.
   - Check `stop_reason === "refusal"` before reading content; on refusal, show the
     user a calm message rather than an error.
   - The system prompt is loaded from a single file, `lib/echo/skill.md`, and marked
     with `cache_control: { type: "ephemeral" }` so it isn't re-billed every turn.
     For now put a placeholder in that file with a comment saying the real one comes
     from the client. Everything about EchoMe's personality lives in that one file —
     do not scatter tone instructions through the code.
7. A content-free telemetry helper: per turn, record duration, input/output/cache
   token counts, model, and error class. Never the text. We cannot debug by reading
   conversations, so this is the only visibility we will ever have.

WHAT NOT TO BUILD YET
No Stripe, no xTiles, no closing ritual, no inactivity nudge, no admin dashboard,
no memory distillation. Those are later phases and building them early will make
the wrong assumptions.

HOW TO WORK
Plan before you write code, and show me the plan and the data model first.
Ask me about anything ambiguous instead of guessing — especially anything where
guessing wrong would mean storing something we shouldn't.
Commit in small, working increments with clear messages.
When the phase is done, run it and show me: a signed-up user, a streamed reply,
the session surviving a server restart, and the encryption test passing.

DEFINITION OF DONE
I can sign up on my phone, have a conversation, close the browser, open it on my
laptop two days later, and the conversation is still there mid-thought — and
there is no readable copy of anything I said anywhere in the database.
```

---

## Prompt 2 — The memory pipeline (Phase 2, October)

> Do not start this until the client's build spec and `skill.md` are in hand.
> The Compass/Map field shapes are the schema; guessing them wastes the phase.

```
Phase 2 of EchoMe: the memory pipeline. Re-read CLAUDE.md.

I'm attaching the client's build spec and skill file. The EchoCompass and EchoMap
schemas in them are authoritative — put them in one module, `lib/echo/schema.ts`,
as typed schemas used both for validation and as the Claude structured-output
format, so that changing the spec means editing one file.

BUILD
1. The distiller (`lib/echo/distill.ts`): takes a finished session transcript in
   memory, calls `claude-haiku-4-5` with `output_config.format` set to the
   Compass/Map schema, and returns validated structured data. It returns JSON or it
   fails — never prose, never a summary paragraph. Use `client.messages.parse()`.
2. The closing ritual: the user-facing flow that ends a session. Show them what
   EchoMe drew out of the conversation, let them choose what to keep, write the kept
   material to their xTiles, then destroy the session key and delete the row —
   in that order, and only after the write succeeds.
3. The inactivity nudge: a Vercel Cron job that finds sessions idle 48–72 hours and
   sends the "want to finish this conversation?" prompt by email and in-app. This is
   the only thing that starts a closing ritual. Make the window configurable.
4. The xTiles connection: per-user OAuth link, tokens encrypted at rest, plus read
   and write of the Compass/Map views. Put every xTiles call behind one adapter
   interface with a local fake implementation, so the app is testable and so we can
   swap the transport if the API turns out to work differently than documented.
5. Recovery: if the xTiles write fails, the session must NOT be destroyed. Retry,
   and tell the user plainly what happened.

Show me the whole flow working end to end on a real conversation before we tune it.
```

---

## Prompt 3 — Payments, onboarding and guardrails (Phase 3, November)

```
Phase 3 of EchoMe. Re-read CLAUDE.md.

1. Stripe: [one-time Access tier / monthly Founders tier — confirm final pricing
   before writing this]. Checkout for purchase, Customer Portal for management,
   webhooks that flip an entitlement flag in our database. Card data never touches
   our code. Handle the webhook signature check and idempotency properly.
2. Post-purchase pack, sent by Resend on successful payment: xTiles setup
   instructions and login details, plus the Echo Circle community invite link.
3. The free introductory conversation: one session, no payment, for a new visitor.
   [Confirm with the client whether this requires an account.]
4. Guardrails:
   - The watchman: a `claude-haiku-4-5` classification pass over each user message,
     max_tokens 256, returning a flag only. It never rewrites and never blocks.
   - When it flags, surface crisis resources in the interface. The wording and the
     resource list come from the client — put them in one config file, not in code.
   - The not-therapy disclaimer at signup and persistently in the chat interface.
5. Admin: a role-gated page listing users, signup date, subscription status, and
   session counts. Counts only — never conversation content, not even for admins.
```

---

## Prompt 4 — Launch hardening (Phase 4, December)

```
Phase 4 of EchoMe: get it ready for real people. Re-read CLAUDE.md.

1. Erasure audit. Write and run a test that takes a full session through the
   closing ritual, then greps the entire database, all logs, and Sentry for any
   fragment of the conversation. It must come back empty. This is the single most
   important test in the codebase.
2. Security pass: RLS on every table verified by test, no service-role key reachable
   from a client component, rate limiting on auth and chat endpoints, Stripe webhook
   signatures verified, secrets audit.
3. Mobile pass on real viewport sizes, keyboard-open behaviour, and slow networks.
4. Cost telemetry: a running per-user token spend figure so the client can see what
   an active user actually costs before it becomes a surprise.
5. Failure behaviour: what the user sees when Claude is down, when xTiles is down,
   when their session can't be decrypted. Every one of those needs a calm, human
   message — this app is used by people in a reflective state.
```

---

## Next steps — closing the gaps before launch

All four phases above are built and running (see `README.md`). What's left is not
new phases — it's the seams each phase deliberately left open, waiting on
something only the client or a real backend can supply. Checked against the
actual code as of this writing:

### Blocked on the client (Todd Savard)

These files are placeholders on purpose — see the header comment in each for
why guessing would be worse than waiting:

1. **`lib/echo/skill.md`** — EchoMe's entire personality is this one file, and
   it's still the scaffolding placeholder. Nothing about tone or boundaries
   should be edited anywhere else.
2. **`lib/echo/schema.ts`** — the EchoCompass/EchoMap field shapes are a
   reasonable guess, not the client's authoritative spec. Everything
   downstream (distiller, closing ritual, xTiles writes) reads this one file.
3. **`lib/config/crisis.ts`** — `RESOURCES` is deliberately empty. Until it's
   filled in with a verified, per-region list, the interface shows a generic
   fallback rather than inventing hotline numbers.
4. **`lib/config/pricing.ts`** — both tiers still show `$—` as `displayPrice`.
   Stripe charges whatever `STRIPE_PRICE_ACCESS`/`STRIPE_PRICE_FOUNDERS` point
   to regardless, so a stale label here is a wrong *display*, not a wrong
   charge — but it still needs fixing before anyone sees a price.
5. **`lib/echo/messages.ts`** — every user-facing string (disclaimer, refusal
   wording, error copy) is marked "PLACEHOLDER WORDING. Client to confirm."

### Engineering work, not client-blocked

6. **`lib/xtiles/http.ts`** — the real xTiles transport throws
   `NOT_IMPLEMENTED` on every write. The adapter interface, the local fake,
   encrypted token storage, and the OAuth connect/callback routes are all
   finished around it — it needs four specifics from xTiles' own API docs
   (OAuth authorise/token URLs, the view write endpoint's payload shape,
   whether it honours an idempotency key, and refresh-token semantics). See
   the file's header for the full list.
7. **Google and Facebook sign-in** — both are fully wired
   (`signInWithProvider`, the `/auth/callback` route) but stay rendered as
   disabled "Soon" buttons until real OAuth credentials are entered in the
   Supabase dashboard and `enabled: true` is flipped in
   `lib/auth/providers.ts`. Setup steps for both are in `README.md`.
8. **This environment's own Supabase project** — separate from the four items
   above, *this specific deployment* is mid-setup: the publishable and secret
   keys are in `.env.local`, but it's still missing the project URL, both
   migrations (`0001_init.sql`, `0002_phases_2_to_4.sql`) run against it, and
   the Auth redirect URLs configured. `ECHOME_LOCAL_MODE` stays on until all
   three are done.

### Before calling any of it launched

9. Re-run Phase 4's own checklist for real, against a real Supabase project
   rather than local mode: `npm run doctor` clean, `npm test` (the erasure
   audit) passing, and RLS re-verified table by table under the anon key —
   local mode never touches Postgres, so none of this has been proven against
   the real database yet.
