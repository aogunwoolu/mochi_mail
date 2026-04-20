create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null,
  avatar_url text,
  bio text,
  accent_color text,
  wallpaper text,
  youtube_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.spaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid unique not null references public.profiles(id) on delete cascade,
  title text not null,
  tagline text not null default '',
  about_me text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.space_items (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  type text not null check (type in ('note', 'about', 'image', 'drawing')),
  title text not null default 'Note',
  content text not null default '',
  x integer not null default 120,
  y integer not null default 120,
  width integer not null default 220,
  height integer not null default 170,
  color text not null default '#fff3b0',
  rotation real not null default 0,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_spaces_owner_id on public.spaces(owner_id);
create index if not exists idx_space_items_space_id on public.space_items(space_id);

alter table public.profiles enable row level security;
alter table public.spaces enable row level security;
alter table public.space_items enable row level security;

create policy "profiles_select_public"
on public.profiles
for select
using (true);

create policy "profiles_insert_own"
on public.profiles
for insert
with check (auth.uid() = id);

create policy "profiles_update_own"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "spaces_select_public"
on public.spaces
for select
using (true);

create policy "spaces_insert_own"
on public.spaces
for insert
with check (owner_id = auth.uid());

create policy "spaces_update_own"
on public.spaces
for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "space_items_select_public"
on public.space_items
for select
using (true);

create policy "space_items_write_own_space"
on public.space_items
for all
using (
  exists (
    select 1
    from public.spaces s
    where s.id = space_id and s.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.spaces s
    where s.id = space_id and s.owner_id = auth.uid()
  )
);
