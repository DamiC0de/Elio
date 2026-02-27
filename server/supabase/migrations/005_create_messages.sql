-- 005: Messages

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role message_role NOT NULL,
  content TEXT NOT NULL,
  audio_url TEXT,
  tokens_in INT DEFAULT 0,
  tokens_out INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);

-- RLS (via conversation ownership)
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY msg_select_own ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY msg_insert_own ON messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY msg_delete_own ON messages
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND c.user_id = auth.uid()
    )
  );
