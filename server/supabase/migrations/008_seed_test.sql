-- 008: Seed data for testing (dev only)
-- NOTE: This requires a test user in auth.users first
-- Run this manually after creating a test account via Supabase Auth

-- Example seed (uncomment after creating auth user):
/*
INSERT INTO users (id, email, display_name, subscription_tier)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'test@elio.ai',
  'TestUser',
  'pro'
);

INSERT INTO conversations (id, user_id)
VALUES (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001'
);

INSERT INTO messages (conversation_id, role, content)
VALUES
  ('00000000-0000-0000-0000-000000000010', 'user', 'Salut Elio !'),
  ('00000000-0000-0000-0000-000000000010', 'assistant', 'Salut ! Comment je peux t''aider ?');

INSERT INTO memories (user_id, category, content, relevance_score)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'preference', 'Préfère le jazz', 0.8),
  ('00000000-0000-0000-0000-000000000001', 'person', 'Sophie est sa femme', 0.9),
  ('00000000-0000-0000-0000-000000000001', 'fact', 'Habite à Lyon', 0.7);
*/
