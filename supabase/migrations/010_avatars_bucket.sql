-- The `avatars` bucket is used by useAccount.ts (profile avatar) and
-- SpaceStudio.tsx (space background images) but was only ever created
-- manually via the dashboard - never checked into a migration. Codifying it
-- here so it's reproducible and so we can pin its RLS to the same
-- own-folder-only convention already used by every other bucket.
--
-- Safe to run more than once.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  10485760, -- 10 MB per file (space backgrounds can be larger than a small avatar)
  array['image/png', 'image/jpeg', 'image/gif', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Objects live under `${userId}/...` (see useAccount.uploadAvatar and
-- SpaceStudio.uploadBgImage); only the owner may write into their own folder,
-- and anyone may read (avatars/backgrounds are shown on public space pages).
drop policy if exists "avatars insert own folder" on storage.objects;
create policy "avatars insert own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "avatars update own folder" on storage.objects;
create policy "avatars update own folder" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "avatars read" on storage.objects;
create policy "avatars read" on storage.objects
  for select to public
  using (bucket_id = 'avatars');
