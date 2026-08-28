-- Codifies room-management RPCs that previously existed only via the
-- dashboard (found via manual pg_get_functiondef introspection during a
-- security audit - see repo memory). Bodies are reproduced verbatim from the
-- live database; this is a documentation/reproducibility fix, not a
-- behavior change. Password hashing already correctly uses bcrypt
-- (crypt()/gen_salt('bf')) via pgcrypto - never plaintext.

CREATE OR REPLACE FUNCTION public.create_room(
  p_title text,
  p_description text DEFAULT ''::text,
  p_is_public boolean DEFAULT true,
  p_password text DEFAULT NULL::text
)
RETURNS TABLE(id uuid, invite_token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.join_room_by_token(
  p_token text,
  p_password text DEFAULT NULL::text
)
RETURNS TABLE(room_id uuid, room_title text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.update_room_security(
  p_room_id uuid,
  p_is_public boolean,
  p_password text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
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
$function$;
