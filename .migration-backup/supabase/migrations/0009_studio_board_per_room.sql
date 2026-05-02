-- Scope studio boards per room.
-- Existing rows get room_id = 'personal' (the personal canvas scope).

alter table public.studio_boards
  add column room_id text not null default 'personal';

-- Replace the single-user unique index with a per-user-per-room one.
drop index if exists studio_boards_created_by_idx;

create unique index studio_boards_created_by_room_idx
  on public.studio_boards (created_by, room_id);
