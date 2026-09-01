-- EchoMe Phases 2–4: memory pipeline, payments, guardrails, hardening.
--
-- THE RULE STILL HOLDS. Nothing here stores conversation content.
--
-- Two tables come close enough to be worth spelling out:
--   distillations  keeps a RECEIPT of a distillation, never the distilled text.
--                  The Compass/Map content lives in the user's own xTiles.
--   safety_flags   keeps a category and a timestamp. Never the message that
--                  triggered it, never an excerpt, never a score derived from
--                  its wording.

-- ---------------------------------------------------------------------------
-- profiles: role, and the one free conversation
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('member', 'admin');

alter table public.profiles
  add column role public.user_role not null default 'member',
  add column free_intro_used boolean not null default false;

comment on column public.profiles.free_intro_used is
  'The free introductory conversation is once per account, forever.';

-- Admins are made by hand in the SQL editor, never by the application:
--   update public.profiles set role = 'admin' where email = '...';

-- ---------------------------------------------------------------------------
-- entitlements — what someone has paid for
-- ---------------------------------------------------------------------------

create type public.entitlement_tier as enum ('none', 'access', 'founders');
create type public.entitlement_status as enum ('inactive', 'active', 'past_due', 'canceled');

create table public.entitlements (
  user_id                uuid primary key references auth.users (id) on delete cascade,
  tier                   public.entitlement_tier not null default 'none',
  status                 public.entitlement_status not null default 'inactive',
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  -- For the monthly tier. Null for the one-time purchase, which never lapses.
  current_period_end     timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

comment on table public.entitlements is
  'Set only by the Stripe webhook. Card data never touches this database.';

create index entitlements_customer on public.entitlements (stripe_customer_id);

alter table public.entitlements enable row level security;

-- A person may see what they have bought. Only the webhook writes.
create policy "entitlements: read own"
  on public.entitlements for select
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- stripe_events — webhook idempotency
-- ---------------------------------------------------------------------------

create table public.stripe_events (
  id           text primary key,
  type         text not null,
  received_at  timestamptz not null default now()
);

comment on table public.stripe_events is
  'Stripe retries. An insert here is the idempotency check: if the id already '
  'exists, the event has been handled and is acknowledged without re-applying.';

alter table public.stripe_events enable row level security;
revoke all on public.stripe_events from anon, authenticated;

-- ---------------------------------------------------------------------------
-- xtiles_connections — per-user OAuth link, tokens encrypted at rest
-- ---------------------------------------------------------------------------

create table public.xtiles_connections (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  workspace_id       text,
  -- Same envelope as live_sessions: a random data key encrypts the tokens, and
  -- that key is wrapped under SESSION_MASTER_KEY. Layout of wrapped_key is
  -- nonce(12) || ciphertext || tag(16).
  encrypted_tokens   bytea not null,
  wrapped_key        bytea not null,
  nonce              bytea not null,
  expires_at         timestamptz,
  connected_at       timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.xtiles_connections is
  'OAuth tokens for the user''s own xTiles workspace, encrypted at rest with '
  'the same envelope used for session payloads.';

alter table public.xtiles_connections enable row level security;
revoke all on public.xtiles_connections from anon, authenticated;

-- ---------------------------------------------------------------------------
-- distillations — a receipt, not a record
-- ---------------------------------------------------------------------------

create table public.distillations (
  id           uuid primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  -- No foreign key: the session row is deleted moments after this is written.
  session_id   uuid not null,
  created_at   timestamptz not null default now(),
  -- Where it landed in the user's xTiles, so a failed write can be retried and
  -- a successful one can be found again.
  xtiles_ref   text,
  -- Counts only. How many things were drawn out, and how many the person kept.
  compass_items integer not null default 0,
  map_items     integer not null default 0,
  kept_items    integer not null default 0,
  -- 'pending' until the xTiles write succeeds. The session is NOT destroyed
  -- until this reaches 'written'.
  state        text not null default 'pending'
                 check (state in ('pending', 'written', 'failed')),
  attempts     integer not null default 0,
  last_error   text
);

comment on table public.distillations is
  'A receipt that a distillation happened and where it was written. It holds '
  'counts and a reference. It never holds the distilled content, and never '
  'holds conversation text.';

comment on column public.distillations.last_error is
  'An error CLASS only — never an API body, which can echo the request.';

create index distillations_user on public.distillations (user_id, created_at desc);
create index distillations_retry on public.distillations (state) where state = 'failed';

alter table public.distillations enable row level security;
revoke all on public.distillations from anon, authenticated;

-- ---------------------------------------------------------------------------
-- safety_flags — the watchman's output
-- ---------------------------------------------------------------------------

create table public.safety_flags (
  id         bigserial primary key,
  user_id    uuid references auth.users (id) on delete set null,
  session_id uuid,
  created_at timestamptz not null default now(),
  -- One short label from a fixed vocabulary. See lib/echo/watchman.ts.
  category   text not null
);

comment on table public.safety_flags is
  'The watchman flags, it never blocks and never rewrites. This table holds a '
  'category and a time. There is no column for the message, an excerpt of it, '
  'or anything derived from its wording.';

create index safety_flags_user on public.safety_flags (user_id, created_at desc);

alter table public.safety_flags enable row level security;
revoke all on public.safety_flags from anon, authenticated;

-- ---------------------------------------------------------------------------
-- live_sessions: the inactivity nudge needs to remember it nudged
-- ---------------------------------------------------------------------------

alter table public.live_sessions
  add column nudged_at timestamptz;

comment on column public.live_sessions.nudged_at is
  'Set by the cron job so a session is nudged once, not once per run.';

-- Finds idle sessions cheaply. The nudge window is configurable in code, so
-- this index deliberately carries no time constant of its own.
create index live_sessions_nudge_scan
  on public.live_sessions (last_active_at)
  where status = 'open' and nudged_at is null;

-- ---------------------------------------------------------------------------
-- rate limiting — auth and chat endpoints
-- ---------------------------------------------------------------------------

create table public.rate_limits (
  -- A bucket key: "chat:<user id>" or "auth:<ip hash>". Never a raw address.
  key        text not null,
  window_start timestamptz not null,
  count      integer not null default 0,
  primary key (key, window_start)
);

comment on table public.rate_limits is
  'Fixed-window counters. Keys are hashed where they derive from an IP, so this '
  'table cannot be used to reconstruct who visited when.';

create index rate_limits_sweep on public.rate_limits (window_start);

alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

-- Atomic increment. Doing this in application code would race between the read
-- and the write, and two tabs would each see themselves as under the limit.
create function public.bump_rate_limit(
  bucket_key text,
  window_start_at timestamptz
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_count integer;
begin
  insert into public.rate_limits (key, window_start, count)
  values (bucket_key, window_start_at, 1)
  on conflict (key, window_start)
    do update set count = public.rate_limits.count + 1
  returning count into new_count;
  return new_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- admin: counts only, never content
-- ---------------------------------------------------------------------------

-- A view rather than a query in application code, so "admins see counts, never
-- content" is enforced at the database rather than remembered by a developer.
create view public.admin_user_summary
with (security_invoker = true)
as
select
  p.id,
  p.email,
  p.created_at as signed_up_at,
  p.role,
  coalesce(e.tier, 'none')     as tier,
  coalesce(e.status, 'inactive') as subscription_status,
  (select count(*) from public.distillations d where d.user_id = p.id) as conversations_closed,
  (select count(*) from public.live_sessions s where s.user_id = p.id and s.status = 'open') as open_sessions,
  (select coalesce(sum(t.input_tokens + t.output_tokens), 0)
     from public.turn_telemetry t where t.user_id = p.id) as total_tokens,
  (select max(t.created_at) from public.turn_telemetry t where t.user_id = p.id) as last_active_at
from public.profiles p
left join public.entitlements e on e.user_id = p.id;

comment on view public.admin_user_summary is
  'Every column is an identifier, a date, a status or a count. There is no '
  'join here that could reach conversation content, because no table holds any.';
