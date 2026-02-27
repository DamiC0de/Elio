-- 006: Memories with pgvector

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category memory_category NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(1536),
  source_conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  relevance_score FLOAT DEFAULT 0.5,
  remind_at TIMESTAMPTZ, -- For reminders
  sent BOOLEAN DEFAULT FALSE, -- For reminder notifications
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER memories_updated_at
  BEFORE UPDATE ON memories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX idx_memories_user_id ON memories(user_id);
CREATE INDEX idx_memories_category ON memories(user_id, category);
CREATE INDEX idx_memories_reminders ON memories(remind_at, sent) WHERE category = 'reminder';

-- HNSW index for semantic search (better than ivfflat for < 1M rows)
CREATE INDEX idx_memories_embedding ON memories
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- RLS
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY mem_select_own ON memories
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY mem_insert_own ON memories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY mem_update_own ON memories
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY mem_delete_own ON memories
  FOR DELETE USING (auth.uid() = user_id);
