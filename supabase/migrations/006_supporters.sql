-- Mochi Plus membership + "buy us a tea" tips.
--
-- KIND-MONETISATION RULES baked into the schema:
--   * `supporters` is the single source of truth for membership. Clients may only
--     READ their own row (RLS); all writes come from the Stripe webhook via the
--     service-role key, so entitlement can never be forged from the browser.
--   * `tips` is a lightweight, append-only log so we can say thank-you and (later)
--     show a kind supporters wall. Tips never grant entitlement.
--
-- A supporter row is keyed by the Supabase user id. Subscribers are always
-- "saved" accounts (anonymous users are gently asked to save their account at
-- checkout), so the ON DELETE CASCADE here only fires if a real account is
-- deleted -- not by the daily anonymous-user cleanup (see 005).

-- ── Membership ────────────────────────────────────────────────────────────────
create table if not exists public.supporters (
  user_id                uuid        primary key references auth.users(id) on delete cascade,
  stripe_customer_id     text        unique,
  stripe_subscription_id text,
  status                 text        not null default 'none',   -- none|active|trialing|past_due|canceled
  plan                   text,                                   -- monthly|yearly
  current_period_end     timestamptz,
  cancel_at_period_end   boolean     not null default false,
  show_badge             boolean     not null default true,      -- member can hide their ♡ badge
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- ── Tips (no-commitment "buy us a tea") ─────────────────────────────────────────
create table if not exists public.tips (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid,                                            -- nullable: tips work for anonymous users too
  display_name text,
  amount_cents integer     not null,
  currency     text        not null default 'usd',
  created_at   timestamptz not null default now()
);

-- Public, render-only badge flag on the existing profile. The webhook keeps this
-- in sync with membership (active AND the member hasn't hidden their badge), so
-- visitors to a public space can see the ♡ without exposing private billing rows.
alter table public.profiles
  add column if not exists is_supporter boolean not null default false;

-- ── RLS ─────────────────────────────────────────────────────────────────────────
alter table public.supporters enable row level security;
alter table public.tips       enable row level security;

-- Members read their own membership; nobody writes from the client (webhook only).
create policy "Members read own membership"
  on public.supporters for select
  using (auth.uid() = user_id);

-- A member may toggle their own badge visibility. The RLS policy scopes writes to
-- their own row; the column-level grant below scopes them to ONLY `show_badge`, so
-- entitlement fields (status, period end, …) can never be forged from the client.
create policy "Members toggle own badge"
  on public.supporters for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke update on public.supporters from anon, authenticated;
grant  update (show_badge) on public.supporters to authenticated;

-- Tips are publicly readable (for a future kind supporters wall); inserts are
-- webhook-only (service role bypasses RLS), so no insert policy is granted.
create policy "Public read tips" on public.tips for select using (true);

create index if not exists tips_created_at_idx on public.tips (created_at desc);
