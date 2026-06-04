-- Scheduled cleanup of stale anonymous users.
--
-- Anonymous (guest) Supabase users accumulate indefinitely. This removes any
-- anonymous user older than 30 days, daily. Deleting the auth.users row cascades
-- (ON DELETE CASCADE) to profiles -> spaces, space_items, store_states,
-- mail_states, asset_states, rooms, room_members, and studio_boards. The only
-- per-user tables that reference the user by a plain TEXT id (no FK) are
-- `letters` and `board_strokes`, so those are cleaned explicitly first.

create extension if not exists pg_cron;

create or replace function public.delete_old_anonymous_users()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids      uuid[];
  v_text_ids text[];
  v_count    integer;
begin
  select array_agg(id) into v_ids
  from auth.users
  where is_anonymous = true
    and created_at < now() - interval '30 days';

  if v_ids is null then
    return 0;
  end if;

  select array_agg(x::text) into v_text_ids from unnest(v_ids) as x;

  -- Tables keyed by a plain TEXT user id (not covered by FK cascade)
  delete from public.letters
    where sender_id = any(v_text_ids) or receiver_id = any(v_text_ids);
  delete from public.board_strokes
    where artist_id = any(v_text_ids);

  -- Deleting the auth user cascades to the remaining per-user tables.
  v_count := array_length(v_ids, 1);
  delete from auth.users where id = any(v_ids);

  return v_count;
end;
$$;

-- SECURITY DEFINER function that deletes users must not be callable from the API.
revoke all on function public.delete_old_anonymous_users() from public, anon, authenticated;

-- Schedule it daily at 03:00 UTC (idempotent: drop any existing job first).
do $$
begin
  perform cron.unschedule('delete-old-anonymous-users');
exception when others then
  null; -- job did not exist yet
end
$$;

select cron.schedule(
  'delete-old-anonymous-users',
  '0 3 * * *',
  $$select public.delete_old_anonymous_users();$$
);
