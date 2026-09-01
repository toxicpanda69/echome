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

## Running it without Supabase (local mode)

For trying the app out, there is a development mode that needs no accounts, no
keys and no database:

```bash
echo "ECHOME_LOCAL_MODE=1" >> .env.local
npm run dev
```

You also need `SESSION_MASTER_KEY` set — that one is not optional, because the
encryption is not faked. Generate it as described below.

What is replaced: authentication becomes a cookie holding whatever email you
type, and the session store becomes a JSON file in `.echome-local/`. What is
**not** replaced: the entire encryption path. Same AES-256-GCM envelope, same
per-session key, same destruction. Open `.echome-local/sessions.json` and look
— your words are not in there.

Without `ANTHROPIC_API_KEY`, replies come from a canned local responder that
streams word by word, so the conversation UI works end to end with nothing
configured at all. Set a real key and it uses Claude instead. Stub turns are
recorded with the model `local-stub` so they can never be mistaken for real
ones.

Sign in with two different addresses to confirm one person cannot see
another's conversation. Restart the dev server to confirm a conversation
survives it.

Google, Facebook, magic links and password reset all need Supabase and are
unavailable in this mode.

### The test console

Sign in, then open <http://localhost:3000/test.html>. It talks to the same
`/api/chat` the real UI uses — your API key never leaves the server — but shows
what the polished interface hides:

- every NDJSON event as it arrives, timestamped
- the decrypted transcript, and how many encrypted bytes are on disk
- per-turn telemetry: model, duration, token counts, and cache reads

That last column is the one worth watching. Prompt caching can only pay off
from the second turn onwards, so a cache read of 0 on turn one is correct and a
0 on turn three is a bug. Telemetry in local mode is appended to
`.echome-local/telemetry.jsonl`; in production it goes to `turn_telemetry`.

`/api/local/session`, which the console reads, returns a decrypted transcript
over HTTP. It is a 404 outside local mode, and there is a test for that.

`next build` refuses to run at all while the flag is set — see
`scripts/check-build-env.mjs`. Turbopack also warns that the local store's file
access widens build tracing; that is accurate, harmless, and goes away with the
directory in Phase 4.

> **Local mode is a development auth bypass and refuses to run anywhere else.**
> If `ECHOME_LOCAL_MODE=1` is set while `NODE_ENV` is production, or on Vercel,
> [`lib/local/mode.ts`](lib/local/mode.ts) throws at import and the app will not
> start. A crash on deploy beats a live app with no real login. The whole
> `lib/local/` directory is scheduled for deletion in Phase 4's security pass.

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
to match `NEXT_PUBLIC_SITE_URL`, and add both of these to the redirect allow
list:

```
<site-url>/auth/confirm
<site-url>/auth/callback
```

`/auth/confirm` handles emailed links (signup confirmation, password reset,
magic link). `/auth/callback` handles the return trip from Google and Facebook.

Supabase's built-in email is rate limited to a handful per hour — fine for
testing, replaced by Resend in Phase 3. That limit applies to magic links too,
so expect to hit it if you test the link flow repeatedly.

**4. Anthropic.** An API key with access to `claude-opus-5`.

**5. The master key.** Generate one:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Put it in `SESSION_MASTER_KEY` and back it up. Losing it makes every open
conversation permanently unreadable — which is the intended failure mode, but
you would rather not find that out by accident.

Then check it before you run it:

```bash
npm run doctor
```

That verifies all five variables are set, that `SESSION_MASTER_KEY` is really 32
bytes, that the three tables exist, that the anon key **cannot** read
`live_sessions` or `turn_telemetry`, and that your API key can actually reach
`claude-opus-5`. It never prints a secret. When it comes back green:

```bash
npm run dev
```

## Commands

| | |
|---|---|
| `npm run dev` | development server |
| `npm run build` | production build |
| `npm run doctor` | preflight: env, schema, RLS, API key |
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
lib/auth/providers.ts     the social provider registry
proxy.ts                  session refresh + the signed-out gate
```

Two files are wholly the client's to write: `lib/echo/skill.md` (EchoMe's
voice) and `lib/echo/messages.ts` (what the app says on its own behalf). Both
currently hold placeholders.

## Sign-in methods

Three ways in, all reaching the same account. A person who signs up with Google
and later uses a magic link on the same address lands on the same profile —
Supabase links identities by verified email.

| Method | Where the code lives |
|---|---|
| Email + password | `signIn` / `signUp` in `app/(auth)/actions.ts` |
| Magic link (passwordless) | `sendMagicLink`, returns via `/auth/confirm` |
| Google, Facebook | `signInWithProvider`, returns via `/auth/callback` |

Providers are declared once in [`lib/auth/providers.ts`](lib/auth/providers.ts).
Adding a fourth means adding an entry there and enabling it in Supabase;
nothing else in the codebase needs to change.

Until a provider is enabled in the dashboard its button still renders, and
pressing it returns the user to `/login` with a readable message rather than a
broken page.

### Enabling Google

1. In the [Google Cloud console](https://console.cloud.google.com), create a
   project, then **APIs & Services → Credentials → Create OAuth client ID →
   Web application**.
2. Configure the OAuth consent screen first if prompted. External user type,
   and the app stays in Testing until you submit for verification — in Testing
   only accounts you list can sign in, which is what you want while building.
3. Under **Authorised redirect URIs** add your Supabase callback, which is
   your project URL plus `/auth/v1/callback`:
   ```
   https://<project-ref>.supabase.co/auth/v1/callback
   ```
   This is the Supabase URL, not `echomechat.ai`. A common half hour is lost
   putting the app's own callback here instead.
4. Copy the client ID and client secret into Supabase → Authentication →
   Providers → Google, and enable it.

### Enabling Facebook

1. At [developers.facebook.com](https://developers.facebook.com), create an app
   of type **Consumer**, then add the **Facebook Login** product.
2. Under Facebook Login → Settings, add the same Supabase callback to **Valid
   OAuth Redirect URIs**:
   ```
   https://<project-ref>.supabase.co/auth/v1/callback
   ```
3. Copy the App ID and App Secret into Supabase → Authentication → Providers →
   Facebook, and enable it.
4. **The part that takes time:** Facebook returns no email address until the
   `email` permission has Advanced Access, which requires app review and
   business verification. In Development mode the app works for accounts with a
   role on it (admins, developers, testers), so you can test immediately — but
   budget real calendar time for verification before launch. We request the
   `email` scope in `lib/auth/providers.ts`; without it Supabase creates the
   user with no email address on file.

## Seams left open

**Session destruction.** `destroySession` is complete and tested, and nothing
in the UI calls it. That is deliberate: the closing ritual that decides what to
keep is Phase 2, and until it exists there should be no way to end a
conversation by accident.

## Not built yet, on purpose

Stripe, xTiles, the closing ritual, the inactivity nudge, the admin dashboard,
memory distillation. Building them now would bake in assumptions the client's
build spec has not settled.
