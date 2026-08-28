-- Performance pass for scaling to thousands of concurrent users on Supabase Pro.
--
-- Two categories of change:
--   1. Missing indexes on columns used in WHERE/JOIN/RLS clauses (avoids seq scans).
--   2. RLS policies rewritten so `auth.uid()` is wrapped in `(select auth.uid())`.
--      Postgres can cache a scalar subquery result for the whole statement instead
--      of re-evaluating the function per row, which matters a lot once tables have
--      thousands+ of rows (this is the documented Supabase RLS perf best practice).
--
-- Safe to run more than once (IF NOT EXISTS / DROP POLICY IF EXISTS guards).

-- ── letters ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS letters_sender_id_idx ON public.letters (sender_id);
CREATE INDEX IF NOT EXISTS letters_receiver_id_idx ON public.letters (receiver_id);
CREATE INDEX IF NOT EXISTS letters_receiver_username_idx ON public.letters (receiver_username);
-- Covers the "unread inbox count" / ordered inbox fetch pattern.
CREATE INDEX IF NOT EXISTS letters_receiver_id_sent_at_idx ON public.letters (receiver_id, sent_at DESC);

DROP POLICY IF EXISTS "Sender can insert" ON public.letters;
CREATE POLICY "Sender can insert"
  ON public.letters FOR INSERT
  WITH CHECK ((select auth.uid())::text = sender_id);

DROP POLICY IF EXISTS "Participants can read" ON public.letters;
CREATE POLICY "Participants can read"
  ON public.letters FOR SELECT
  USING (
    (select auth.uid())::text = sender_id
    OR (select auth.uid())::text = receiver_id
    OR (
      receiver_id IS NULL
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = (select auth.uid())
          AND profiles.username = letters.receiver_username
      )
    )
  );

DROP POLICY IF EXISTS "Receiver can update read" ON public.letters;
CREATE POLICY "Receiver can update read"
  ON public.letters FOR UPDATE
  USING  ((select auth.uid())::text = receiver_id)
  WITH CHECK ((select auth.uid())::text = receiver_id);

-- ── profiles ─────────────────────────────────────────────────────────────────
-- Backs username lookups (useSpaces, letters RLS EXISTS check) and must be
-- unique since usernames are used as public slugs.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_idx ON public.profiles (username);

-- ── spaces / space_items ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS spaces_owner_id_idx ON public.spaces (owner_id);
CREATE INDEX IF NOT EXISTS space_items_space_id_idx ON public.space_items (space_id);

-- ── rooms / room_members ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS rooms_owner_id_updated_at_idx ON public.rooms (owner_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS rooms_invite_token_idx ON public.rooms (invite_token);
CREATE INDEX IF NOT EXISTS room_members_room_id_idx ON public.room_members (room_id);
CREATE INDEX IF NOT EXISTS room_members_user_id_idx ON public.room_members (user_id);

-- ── store_item_likes ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS store_item_likes_user_id_idx ON public.store_item_likes (user_id);

DROP POLICY IF EXISTS "Users can like" ON public.store_item_likes;
CREATE POLICY "Users can like"
  ON public.store_item_likes FOR INSERT
  WITH CHECK ((select auth.uid())::text = user_id);

DROP POLICY IF EXISTS "Users can unlike" ON public.store_item_likes;
CREATE POLICY "Users can unlike"
  ON public.store_item_likes FOR DELETE
  USING ((select auth.uid())::text = user_id);

-- ── supporters ───────────────────────────────────────────────────────────────
-- stripe_customer_id already has a UNIQUE constraint (implicit index); the
-- subscription id is looked up by the webhook and has no index yet.
CREATE INDEX IF NOT EXISTS supporters_stripe_subscription_id_idx ON public.supporters (stripe_subscription_id);

DROP POLICY IF EXISTS "Members read own membership" ON public.supporters;
CREATE POLICY "Members read own membership"
  ON public.supporters FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Members toggle own badge" ON public.supporters;
CREATE POLICY "Members toggle own badge"
  ON public.supporters FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ── board_strokes / studio_boards (used by useStrokeSync / useAssets) ───────
CREATE INDEX IF NOT EXISTS board_strokes_room_id_idx ON public.board_strokes (room_id);
-- Shared-room board load does `.eq(room_id).order(updated_at desc).limit(1)`.
CREATE INDEX IF NOT EXISTS studio_boards_room_id_updated_at_idx ON public.studio_boards (room_id, updated_at DESC);
