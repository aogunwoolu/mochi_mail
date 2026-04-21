create table if not exists public.mail_states (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.asset_states (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.store_states (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.mail_states enable row level security;
alter table public.asset_states enable row level security;
alter table public.store_states enable row level security;

create policy "mail_states_select_own"
on public.mail_states
for select
using (owner_id = auth.uid());

create policy "mail_states_insert_own"
on public.mail_states
for insert
with check (owner_id = auth.uid());

create policy "mail_states_update_own"
on public.mail_states
for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "asset_states_select_own"
on public.asset_states
for select
using (owner_id = auth.uid());

create policy "asset_states_insert_own"
on public.asset_states
for insert
with check (owner_id = auth.uid());

create policy "asset_states_update_own"
on public.asset_states
for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "store_states_select_own"
on public.store_states
for select
using (owner_id = auth.uid());

create policy "store_states_insert_own"
on public.store_states
for insert
with check (owner_id = auth.uid());

create policy "store_states_update_own"
on public.store_states
for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());
