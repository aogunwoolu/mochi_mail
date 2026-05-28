-- Cross-user letter delivery table
CREATE TABLE IF NOT EXISTS letters (
  id                  TEXT        PRIMARY KEY,
  sender_id           TEXT        NOT NULL,
  sender_name         TEXT        NOT NULL,
  receiver_id         TEXT,                         -- NULL when recipient has no profile
  receiver_username   TEXT        NOT NULL,         -- slugified username as typed by sender
  receiver_name       TEXT        NOT NULL,
  image_data          TEXT        NOT NULL,
  envelope_image_data TEXT,
  envelope_name       TEXT,
  stamp_image_data    TEXT,
  stamp_name          TEXT,
  stamp_style         TEXT        NOT NULL DEFAULT '',
  sent_at             BIGINT      NOT NULL,         -- ms since epoch
  delivery_duration   BIGINT      NOT NULL,         -- ms
  delivery_speed      TEXT        NOT NULL,
  read                BOOLEAN     NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE letters ENABLE ROW LEVEL SECURITY;

-- Sender can write their own letters
CREATE POLICY "Sender can insert"
  ON letters FOR INSERT
  WITH CHECK (auth.uid()::text = sender_id);

-- Sender and receiver can read
CREATE POLICY "Participants can read"
  ON letters FOR SELECT
  USING (auth.uid()::text = sender_id OR auth.uid()::text = receiver_id);

-- Only the receiver can mark a letter as read
CREATE POLICY "Receiver can update read"
  ON letters FOR UPDATE
  USING  (auth.uid()::text = receiver_id)
  WITH CHECK (auth.uid()::text = receiver_id);
