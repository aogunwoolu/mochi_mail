-- Store marketplace images (stickers, washi, papers, stamps, envelopes, kit
-- previews) were embedded as base64 inside `store_states.payload`, which
-- gets fetched in full for every published user on every app session (see
-- repo memory - this was the largest egress driver found in the 2026-08-28
-- audit, worse than letters since it multiplies by session count). Moving
-- the images to Storage and keeping only a URL in the JSON payload cuts that
-- payload down to near-zero bytes per item instead of tens-to-hundreds of KB.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'store-items',
  'store-items',
  true,
  5242880, -- 5 MB per file - canvas-exported PNGs/GIFs, not raw uploads
  array['image/png', 'image/gif', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Objects live under `${authorId}/${itemId}.png`; only the publishing author
-- may write into their own folder, and anyone may read (public marketplace).
drop policy if exists "store items insert own folder" on storage.objects;
create policy "store items insert own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'store-items'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "store items read" on storage.objects;
create policy "store items read" on storage.objects
  for select to public
  using (bucket_id = 'store-items');
