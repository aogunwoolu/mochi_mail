-- board_strokes: vector-based drawing persistence
-- Each completed pen/eraser stroke is stored as a row instead of syncing
-- the whole canvas as a PNG blob. Canvas state = replay of all strokes in seq order.

create table if not exists public.board_strokes (
  id        text        primary key,
  room_id   text        not null,
  artist_id text        not null,
  tool      text        not null default 'pen',    -- 'pen' | 'eraser'
  color     text        not null default '#000000',
  size      real        not null default 4,
  points    jsonb       not null default '[]',     -- [[x,y,pressure], ...]
  seq       bigint      not null,                  -- ms timestamp, used for ordering
  created_at timestamptz not null default now()
);

-- Efficient range queries: load strokes for a room in draw order
create index if not exists idx_board_strokes_room_seq
  on public.board_strokes (room_id, seq asc);

-- ── Row-level security ───────────────────────────────────────────────────────

alter table public.board_strokes enable row level security;

-- Anyone (including anonymous) can read strokes for a shared board
create policy "board_strokes_select"
  on public.board_strokes for select
  using (true);

-- Authenticated users can insert strokes
create policy "board_strokes_insert"
  on public.board_strokes for insert
  to authenticated
  with check (true);

-- Authenticated users can delete strokes (needed for undo)
create policy "board_strokes_delete"
  on public.board_strokes for delete
  to authenticated
  using (true);
