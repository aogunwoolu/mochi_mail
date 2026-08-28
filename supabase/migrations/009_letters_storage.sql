-- Move letter/envelope/stamp images out of the `letters` table and into
-- Supabase Storage. These were base64 PNG data URLs stored as TEXT columns -
-- often tens to hundreds of KB per letter - which bloated table size, made
-- every inbox SELECT transfer megabytes of pixel data, and slowed down
-- sequential/index scans. Going forward the app writes a public Storage URL
-- instead; old rows keep their base64 columns for backward compatibility, and
-- useMail.ts prefers the *_url column when present.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'letters',
  'letters',
  true,
  5242880, -- 5 MB per file - these are canvas-exported PNGs, not user uploads
  array['image/png']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Objects are stored under `${senderId}/${letterId}/...`; only the owning
-- sender may write into their own folder (mirrors the `avatars` bucket
-- convention), and anyone may read (needed so the receiver's browser can
-- fetch the image by public URL).
drop policy if exists "letters images insert own folder" on storage.objects;
create policy "letters images insert own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'letters'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "letters images read" on storage.objects;
create policy "letters images read" on storage.objects
  for select to public
  using (bucket_id = 'letters');

-- New URL columns; old base64 columns become optional now that new writes
-- go to Storage instead.
alter table public.letters
  add column if not exists image_url text,
  add column if not exists envelope_image_url text,
  add column if not exists stamp_image_url text;

alter table public.letters
  alter column image_data drop not null;
