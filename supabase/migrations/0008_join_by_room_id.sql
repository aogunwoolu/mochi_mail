-- ─── join_room_by_id ─────────────────────────────────────────────────────────
-- Lets any authenticated user join a PUBLIC room directly by its UUID.
-- This is what powers the shareable canvas URL (/?room=ROOM_ID).
--
-- Private rooms still require an invite token (join_room_by_token).
-- The INSERT is idempotent — safe to call even if already a member.

create or replace function public.join_room_by_id(p_room_id uuid)
returns table (
  room_id      uuid,
  room_title   text,
  is_public    boolean,
  invite_token text
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

  select * into v_room from public.rooms where id = p_room_id;

  if not found then
    raise exception 'Room not found';
  end if;

  -- Private rooms: only owner or existing member can call this.
  -- Non-members must use join_room_by_token instead.
  if not v_room.is_public then
    if v_room.owner_id <> v_user and not exists (
      select 1 from public.room_members rm
      where rm.room_id = v_room.id and rm.user_id = v_user
    ) then
      raise exception 'private';
    end if;
  end if;

  insert into public.room_members (room_id, user_id)
  values (v_room.id, v_user)
  on conflict do nothing;

  return query
    select v_room.id, v_room.title, v_room.is_public, v_room.invite_token;
end;
$$;

grant execute on function public.join_room_by_id(uuid) to authenticated;
