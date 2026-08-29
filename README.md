# EchoMe — Phase 1

A private, logged-in web app where a person has a reflective conversation with
Claude. Read [CLAUDE.md](CLAUDE.md) before changing anything: the no-transcript
rule shapes almost every decision in here.

Phase 1 is the foundation and the conversation. The memory pipeline, closing
ritual, payments and xTiles are later phases and are deliberately absent.

## The one thing to understand

Conversation transcripts are never persisted in readable form. There is no
`messages` table. The in-flight transcript lives in exactly one place —
`live_sessions.encrypted_payload` — as AES-256-GCM ciphertext under a key
generated for that session alone, which is itself wrapped under
`SESSION_MASTER_KEY`.

Plaintext exists in two places and no others: server memory for the duration of
one request, and browser memory while the tab is open. Nothing is written to
`localStorage`, `sessionStorage` or IndexedDB.

To see this rather than read about it:

```bash
npm run walkthrough
```

## Getting it running

```bash
npm install
```

Then create `.env.local` from `.env.example` and fill in five values.

**1. Supabase.** Create a project, then from Project Settings → API take the
project URL, the anon key, and the service role key.

**2. The database.** Open the SQL editor and run
[`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) whole.
It creates `profiles`, `live_sessions` and `turn_telemetry`, turns RLS on for
all three, and installs the trigger that creates a profile on signup.

**3. Auth settings.** Under Authentication → URL Configuration set the site URL
to match `NEXT_PUBLIC_SITE_URL`, and add `<site-url>/auth/confirm` to the
redirect allow list. Phase 1 uses Supabase's built-in email for confirmation
and password reset, which is rate limited to a handful per hour — fine for
testing, replaced by Resend in Phase 3.

**4. Anthropic.** An API key with access to `claude-opus-5`.

**5. The master key.** Generate one:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Put it in `SESSION_MASTER_KEY` and back it up. Losing it makes every open
conversation permanently unreadable — which is the intended failure mode, but
you would rather not find that out by accident.

Then:

```bash
npm run dev
```

## Commands

| | |
|---|---|
| `npm run dev` | development server |
| `npm run build` | production build |
| `npm test` | the full suite |
| `npm run walkthrough` | narrated lifecycle, prints what the database holds |
| `npm run typecheck` | `tsc --noEmit` |

## How a turn works

1. `POST /api/chat` authenticates and loads the user's open session.
2. The payload is decrypted in memory, the user's message appended, and the
   whole thing re-encrypted and saved **before Claude is called**. An outage
   costs them the reply, never their own words.
3. `lib/echo/voice.ts` streams the response. Text deltas go to the browser as
   newline-delimited JSON; thinking deltas are consumed and discarded.
4. `stop_reason` is checked before any content is read. On a refusal the user
   sees calm wording from `lib/echo/messages.ts`, and that wording — not the
   model's content — is what gets persisted as the assistant turn.
5. The assistant's content blocks are appended whole, thinking signatures
   included, so a resumed conversation replays to the API exactly as it came
   out. Then the payload is re-encrypted and saved.
6. Content-free telemetry is recorded: duration, token counts, model, stop
   reason, error class. Never text.

## Where things live

```
lib/echo/crypto.ts        envelope encryption and key destruction
lib/echo/sessions.ts      the session lifecycle
lib/echo/store.ts         storage seam + in-memory implementation
lib/echo/postgres-store.ts  the Supabase implementation
lib/echo/voice.ts         the ONLY module that calls the Claude API
lib/echo/skill.md         the system prompt — all personality lives here
lib/echo/messages.ts      user-facing copy: disclaimers and failure wording
lib/echo/telemetry.ts     content-free metrics
```

Two files are wholly the client's to write: `lib/echo/skill.md` (EchoMe's
voice) and `lib/echo/messages.ts` (what the app says on its own behalf). Both
currently hold placeholders.

## Seams left open

**Google OAuth.** `signInWithOAuth` in `app/(auth)/actions.ts` and
`app/auth/callback/route.ts` are both written and unused. Enabling it is a
Supabase dashboard toggle plus one button in `components/auth/AuthForm.tsx`.

**Session destruction.** `destroySession` is complete and tested, and nothing
in the UI calls it. That is deliberate: the closing ritual that decides what to
keep is Phase 2, and until it exists there should be no way to end a
conversation by accident.

## Not built yet, on purpose

Stripe, xTiles, the closing ritual, the inactivity nudge, the admin dashboard,
memory distillation. Building them now would bake in assumptions the client's
build spec has not settled.
