-- Migration: 012_realtime
-- Supabase Realtime replaces the old Socket.IO layer. RLS is what gates who
-- receives streaming row changes: the server itself connects as the postgres
-- superuser and bypasses RLS, so REST stays the single write path, while a
-- Realtime client only sees rows for conversations it is a participant of.

ALTER TABLE messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Participants can receive message rows. auth.uid() is the Supabase Auth user
-- id — mapped to our BIGINT users.id through users.auth_uid.
CREATE POLICY messages_participants_select ON messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND (
          EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = c.user_id AND u.auth_uid = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM specialists s
            JOIN users su ON su.id = s.user_id
            WHERE s.id = c.specialist_id AND su.auth_uid = auth.uid()
          )
        )
    )
  );

CREATE POLICY conversations_participants_select ON conversations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = user_id AND u.auth_uid = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM specialists s
      JOIN users su ON su.id = s.user_id
      WHERE s.id = specialist_id AND su.auth_uid = auth.uid()
    )
  );

-- Stream INSERT/UPDATE/DELETE on these tables to Realtime subscribers.
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;