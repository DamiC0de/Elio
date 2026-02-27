-- 003: Connected services (OAuth tokens)

CREATE TABLE connected_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_type service_type NOT NULL,
  credentials JSONB NOT NULL DEFAULT '{}'::jsonb, -- AES-256 encrypted tokens
  status service_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, service_type)
);

CREATE TRIGGER connected_services_updated_at
  BEFORE UPDATE ON connected_services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE connected_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY cs_select_own ON connected_services
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY cs_insert_own ON connected_services
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY cs_update_own ON connected_services
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY cs_delete_own ON connected_services
  FOR DELETE USING (auth.uid() = user_id);
