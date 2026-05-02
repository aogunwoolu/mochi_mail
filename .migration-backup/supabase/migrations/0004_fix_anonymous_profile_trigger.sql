-- Make profile auto-creation robust for anonymous auth users.
-- Anonymous users often have empty raw_user_meta_data and no email.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  raw_username text;
  fallback_username text;
  final_username text;
  final_display_name text;
begin
  raw_username := nullif(new.raw_user_meta_data->>'username', '');

  fallback_username :=
    case
      when nullif(new.email, '') is not null then split_part(new.email, '@', 1)
      else 'anon_' || replace(substr(new.id::text, 1, 8), '-', '')
    end;

  final_username := lower(regexp_replace(coalesce(raw_username, fallback_username), '[^a-z0-9_]', '_', 'g'));
  final_username := regexp_replace(final_username, '_+', '_', 'g');
  final_username := regexp_replace(final_username, '^_+|_+$', '', 'g');

  if final_username = '' then
    final_username := 'anon_' || replace(substr(new.id::text, 1, 8), '-', '');
  end if;

  -- Guarantee uniqueness if a normalized username is already taken.
  if exists (select 1 from public.profiles p where p.username = final_username) then
    final_username := final_username || '_' || replace(substr(new.id::text, 1, 6), '-', '');
  end if;

  final_display_name := coalesce(
    nullif(new.raw_user_meta_data->>'display_name', ''),
    final_username
  );

  insert into public.profiles (
    id,
    username,
    display_name,
    avatar_url,
    bio,
    accent_color,
    wallpaper
  ) values (
    new.id,
    final_username,
    final_display_name,
    nullif(new.raw_user_meta_data->>'avatar_url', ''),
    coalesce(
      nullif(new.raw_user_meta_data->>'bio', ''),
      'Artist, collector, and letter sender.'
    ),
    nullif(new.raw_user_meta_data->>'accent_color', ''),
    nullif(new.raw_user_meta_data->>'wallpaper', '')
  );

  return new;
end;
$$;
