create extension if not exists pgcrypto;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null default '',
  is_public boolean not null default true,
  invite_token text not null unique default encode(gen_random_bytes(12), 'hex'),
  password_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.room_members (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index if not exists idx_rooms_owner_id on public.rooms(owner_id);
create index if not exists idx_rooms_is_public on public.rooms(is_public);
create index if not exists idx_room_members_user_id on public.room_members(user_id);

alter table public.rooms enable row level security;
alter table public.room_members enable row level security;

drop policy if exists "rooms_select_accessible" on public.rooms;
create policy "rooms_select_accessible"
on public.rooms
for select
using (
  is_public
  or owner_id = auth.uid()
  or exists (
    select 1
    from public.room_members rm
    where rm.room_id = rooms.id and rm.user_id = auth.uid()
  )
);

drop policy if exists "rooms_insert_own" on public.rooms;
create policy "rooms_insert_own"
on public.rooms
for insert
with check (owner_id = auth.uid());

drop policy if exists "rooms_update_own" on public.rooms;
create policy "rooms_update_own"
on public.rooms
for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "rooms_delete_own" on public.rooms;
create policy "rooms_delete_own"
on public.rooms
for delete
using (owner_id = auth.uid());

drop policy if exists "room_members_select" on public.room_members;
create policy "room_members_select"
on public.room_members
for select
using (user_id = auth.uid());

drop policy if exists "room_members_delete_self_or_owner" on public.room_members;
create policy "room_members_delete_self_or_owner"
on public.room_members
for delete
using (user_id = auth.uid());

create or replace function public.create_room(
  p_title text,
  p_description text default '',
  p_is_public boolean default true,
  p_password text default null
)
returns table (id uuid, invite_token text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid := auth.uid();
  v_room public.rooms;
begin
  if v_owner is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.rooms (owner_id, title, description, is_public, password_hash)
  values (
    v_owner,
    coalesce(nullif(trim(p_title), ''), 'Untitled Room'),
    coalesce(p_description, ''),
    coalesce(p_is_public, true),
    case
      when p_password is null or trim(p_password) = '' then null
      else crypt(p_password, gen_salt('bf'))
    end
  )
  returning * into v_room;

  insert into public.room_members (room_id, user_id)
  values (v_room.id, v_owner)
  on conflict do nothing;

  return query select v_room.id, v_room.invite_token;
end;
$$;

create or replace function public.get_room_invite_preview(p_token text)
returns table (
  id uuid,
  title text,
  description text,
  is_public boolean,
  has_password boolean,
  owner_display_name text,
  owner_username text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    r.id,
    r.title,
    r.description,
    r.is_public,
    (r.password_hash is not null) as has_password,
    p.display_name,
    p.username
  from public.rooms r
  join public.profiles p on p.id = r.owner_id
  where r.invite_token = p_token
  limit 1;
end;
$$;

create or replace function public.join_room_by_token(
  p_token text,
  p_password text default null
)
returns table (
  room_id uuid,
  room_title text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_room public.rooms;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_room
  from public.rooms
  where invite_token = p_token
  limit 1;

  if not found then
    raise exception 'Invalid invite link';
  end if;

  if v_room.password_hash is not null then
    if p_password is null or crypt(p_password, v_room.password_hash) <> v_room.password_hash then
      raise exception 'Invalid room password';
    end if;
  end if;

  insert into public.room_members (room_id, user_id)
  values (v_room.id, v_user)
  on conflict do nothing;

  return query select v_room.id, v_room.title;
end;
$$;

create or replace function public.update_room_security(
  p_room_id uuid,
  p_is_public boolean,
  p_password text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.rooms
  set
    is_public = coalesce(p_is_public, is_public),
    password_hash = case
      when p_password is null then password_hash
      when trim(p_password) = '' then null
      else crypt(p_password, gen_salt('bf'))
    end,
    updated_at = now()
  where id = p_room_id
    and owner_id = auth.uid();

  if not found then
    raise exception 'Room not found or permission denied';
  end if;
end;
$$;

create or replace function public.rotate_room_invite_token(p_room_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  update public.rooms
  set
    invite_token = encode(gen_random_bytes(12), 'hex'),
    updated_at = now()
  where id = p_room_id
    and owner_id = auth.uid()
  returning invite_token into v_token;

  if v_token is null then
    raise exception 'Room not found or permission denied';
  end if;

  return v_token;
end;
$$;

grant execute on function public.create_room(text, text, boolean, text) to authenticated;
grant execute on function public.get_room_invite_preview(text) to authenticated;
grant execute on function public.join_room_by_token(text, text) to authenticated;
grant execute on function public.update_room_security(uuid, boolean, text) to authenticated;
grant execute on function public.rotate_room_invite_token(uuid) to authenticated;
