-- Enable realtime for letters so recipients get instant delivery notifications
ALTER PUBLICATION supabase_realtime ADD TABLE letters;

-- Update RLS read policy to also cover letters where receiver_id was null at send time
-- (sender typed a username that didn't have a profile yet)
DROP POLICY IF EXISTS "Participants can read" ON letters;

CREATE POLICY "Participants can read"
  ON letters FOR SELECT
  USING (
    auth.uid()::text = sender_id
    OR auth.uid()::text = receiver_id
    OR (
      receiver_id IS NULL
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.username = letters.receiver_username
      )
    )
  );
