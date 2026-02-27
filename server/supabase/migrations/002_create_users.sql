-- 002: Create users table
-- Links to Supabase Auth (auth.users)

CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  subscription_tier subscription_tier NOT NULL DEFAULT 'free',
  settings JSONB NOT NULL DEFAULT '{
    "personality": {
      "tone": "friendly",
      "verbosity": "normal",
      "formality": "tu",
      "humor": true
    },
    "voice": {
      "wake_word_mode": "manual"
    },
    "onboarding_completed": false,
    "tutorial_completed": false,
    "timezone": "Europe/Paris"
  }'::jsonb,
  push_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_select_own ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY users_update_own ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY users_insert_own ON users
  FOR INSERT WITH CHECK (auth.uid() = id);
