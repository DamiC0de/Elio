-- 004: Conversations

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  message_count INT NOT NULL DEFAULT 0,
  mood_detected TEXT
);

CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_started_at ON conversations(started_at DESC);

-- RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY conv_select_own ON conversations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY conv_insert_own ON conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY conv_update_own ON conversations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY conv_delete_own ON conversations
  FOR DELETE USING (auth.uid() = user_id);
