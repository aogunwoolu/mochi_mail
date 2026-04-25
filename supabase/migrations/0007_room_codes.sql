-- ─── Room Codes ───────────────────────────────────────────────────────────────
-- Adds a short, human-readable 6-char code to every room (e.g. "ABC-123").
-- Users can join a room by entering this code directly — no invite token needed
-- for public rooms.

alter table public.rooms
  add column if not exists room_code text unique;

-- ─── Code generator ──────────────────────────────────────────────────────────
-- Uses an unambiguous alphabet (no 0/O, 1/I/L) to avoid mis-reads.
create or replace function public.generate_room_code()
returns text
language plpgsql
as $$
declare
  chars    text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code     text;
  attempts int  := 0;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(chars, (floor(random() * length(chars)) + 1)::int, 1);
    end loop;
    exit when not exists (select 1 from public.rooms where room_code = code);
    attempts := attempts + 1;
    if attempts > 200 then
      raise exception 'Could not generate a unique room code after 200 attempts';
    end if;
  end loop;
  return code;
end;
$$;

-- Backfill any existing rooms that have no code yet.
do $$
declare r record;
begin
  for r in select id from public.rooms where room_code is null loop
    update public.rooms
       set room_code = public.generate_room_code()
     where id = r.id;
  end loop;
end;
$$;

-- Now make it non-nullable.
alter table public.rooms
  alter column room_code set not null;

-- ─── Trigger: auto-assign code on INSERT ─────────────────────────────────────
create or replace function public.set_room_code_before_insert()
returns trigger
language plpgsql
as $$
begin
  if new.room_code is null or trim(new.room_code) = '' then
    new.room_code := public.generate_room_code();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_rooms_set_code on public.rooms;
create trigger trg_rooms_set_code
  before insert on public.rooms
  for each row execute function public.set_room_code_before_insert();

create index if not exists idx_rooms_room_code on public.rooms(room_code);

-- ─── join_room_by_code ────────────────────────────────────────────────────────
-- Allows joining a public room by its short code (case-insensitive).
-- Private rooms require an invite link — this function will error if the room
-- is private and the caller is not already a member/owner.
create or replace function public.join_room_by_code(
  p_code     text,
  p_password text default null
)
returns table (
  room_id      uuid,
  room_title   text,
  room_code    text,
  invite_token text
)
language plpgsql
security definer
set search_path = public, extensions
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
  where room_code = upper(trim(p_code))
  limit 1;

  if not found then
    raise exception 'Room not found — check the code and try again';
  end if;

  -- Private rooms: caller must already be member/owner, or have a password
  if not v_room.is_public then
    if v_room.owner_id <> v_user and not exists (
      select 1 from public.room_members rm
      where rm.room_id = v_room.id and rm.user_id = v_user
    ) then
      raise exception 'This room is private. Ask the host for an invite link.';
    end if;
  end if;

  if v_room.password_hash is not null then
    if p_password is null or crypt(p_password, v_room.password_hash) <> v_room.password_hash then
      raise exception 'Wrong password';
    end if;
  end if;

  insert into public.room_members (room_id, user_id)
  values (v_room.id, v_user)
  on conflict do nothing;

  return query
    select v_room.id, v_room.title, v_room.room_code, v_room.invite_token;
end;
$$;

grant execute on function public.join_room_by_code(text, text) to authenticated;
