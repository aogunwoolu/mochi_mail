-- Help & Feedback attachments.
-- Public-read bucket that signed-in users (including anonymous guests — see
-- 005) upload screenshots/videos into from the Help & Feedback form. The
-- server route then links the public URLs into the Discord forum thread.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'support-attachments',
  'support-attachments',
  true,
  26214400, -- 25 MB per file
  array[
    'image/png', 'image/jpeg', 'image/gif', 'image/webp',
    'video/mp4', 'video/quicktime', 'video/webm'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "support attachments insert" on storage.objects;
create policy "support attachments insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'support-attachments');

drop policy if exists "support attachments read" on storage.objects;
create policy "support attachments read" on storage.objects
  for select to public
  using (bucket_id = 'support-attachments');
