-- Add persistent studio board snapshots table.
-- Stores canvas drawing bitmap, placed items, and selected paper per user/session.
create table public.studio_boards (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users on delete cascade,
  drawing_data text,
  placed_items jsonb,
  selected_paper jsonb,
  updated_at timestamp with time zone default now(),
  created_at timestamp with time zone default now()
);

-- Unique constraint: one board per user
create unique index studio_boards_created_by_idx on public.studio_boards (created_by);

-- RLS: users can only read/write their own board
alter table public.studio_boards enable row level security;

create policy studio_boards_select
  on public.studio_boards for select
  using (auth.uid() = created_by);

create policy studio_boards_insert
  on public.studio_boards for insert
  with check (auth.uid() = created_by);

create policy studio_boards_update
  on public.studio_boards for update
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

create policy studio_boards_delete
  on public.studio_boards for delete
  using (auth.uid() = created_by);
