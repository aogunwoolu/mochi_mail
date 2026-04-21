-- Automatically create a profile row when a new auth user is created.
-- Runs as SECURITY DEFINER so it bypasses RLS entirely.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
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
    new.raw_user_meta_data->>'username',
    coalesce(
      nullif(new.raw_user_meta_data->>'display_name', ''),
      new.raw_user_meta_data->>'username'
    ),
    new.raw_user_meta_data->>'avatar_url',
    coalesce(
      nullif(new.raw_user_meta_data->>'bio', ''),
      'Artist, collector, and letter sender.'
    ),
    new.raw_user_meta_data->>'accent_color',
    new.raw_user_meta_data->>'wallpaper'
  );
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
