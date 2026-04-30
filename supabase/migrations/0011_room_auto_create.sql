-- join_room_full: join a room by invite token and return full details + ownership flag.
-- Used by the "URL = invite link" flow where the invite token is the URL ?room= param.
-- No password check here — the token itself is the access credential.
-- Already-a-member users are handled idempotently (ON CONFLICT DO NOTHING).

create or replace function public.join_room_full(p_token text)
returns table (
  room_id      uuid,
  room_title   text,
  is_public    boolean,
  is_owner     boolean,
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

  select * into v_room
  from public.rooms
  where rooms.invite_token = p_token
  limit 1;

  if not found then
    raise exception 'Room not found';
  end if;

  insert into public.room_members (room_id, user_id)
  values (v_room.id, v_user)
  on conflict do nothing;

  return query
    select
      v_room.id,
      v_room.title,
      v_room.is_public,
      (v_room.owner_id = v_user) as is_owner,
      v_room.invite_token;
end;
$$;

grant execute on function public.join_room_full(text) to authenticated;
