-- Global download + like counters per store item
CREATE TABLE IF NOT EXISTS store_item_stats (
  item_id    TEXT        PRIMARY KEY,
  downloads  INT         NOT NULL DEFAULT 0,
  likes      INT         NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Per-user likes (one row per user per item)
CREATE TABLE IF NOT EXISTS store_item_likes (
  item_id    TEXT        NOT NULL,
  user_id    TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (item_id, user_id)
);

-- RLS
ALTER TABLE store_item_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_item_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read stats"  ON store_item_stats FOR SELECT USING (true);
CREATE POLICY "Public read likes"  ON store_item_likes FOR SELECT USING (true);
CREATE POLICY "Users can like"     ON store_item_likes FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can unlike"   ON store_item_likes FOR DELETE  USING  (auth.uid()::text = user_id);

-- Atomic download increment (SECURITY DEFINER so anon callers can increment)
CREATE OR REPLACE FUNCTION increment_store_downloads(p_item_id TEXT)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  INSERT INTO store_item_stats (item_id, downloads, likes)
  VALUES (p_item_id, 1, 0)
  ON CONFLICT (item_id)
  DO UPDATE SET
    downloads  = store_item_stats.downloads + 1,
    updated_at = NOW();
$$;

-- Toggle like: inserts or removes a like row and updates the counter
CREATE OR REPLACE FUNCTION toggle_store_like(p_item_id TEXT, p_user_id TEXT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  already_liked BOOLEAN;
  new_likes     INT;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM store_item_likes
    WHERE item_id = p_item_id AND user_id = p_user_id
  ) INTO already_liked;

  IF already_liked THEN
    DELETE FROM store_item_likes
    WHERE item_id = p_item_id AND user_id = p_user_id;

    INSERT INTO store_item_stats (item_id, downloads, likes)
    VALUES (p_item_id, 0, 0)
    ON CONFLICT (item_id)
    DO UPDATE SET
      likes      = GREATEST(0, store_item_stats.likes - 1),
      updated_at = NOW();
  ELSE
    INSERT INTO store_item_likes (item_id, user_id)
    VALUES (p_item_id, p_user_id)
    ON CONFLICT DO NOTHING;

    INSERT INTO store_item_stats (item_id, downloads, likes)
    VALUES (p_item_id, 0, 1)
    ON CONFLICT (item_id)
    DO UPDATE SET
      likes      = store_item_stats.likes + 1,
      updated_at = NOW();
  END IF;

  SELECT likes FROM store_item_stats WHERE item_id = p_item_id INTO new_likes;
  RETURN COALESCE(new_likes, 0);
END;
$$;
