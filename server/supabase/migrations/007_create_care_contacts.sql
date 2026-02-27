-- 007: Care contacts (tier Care)

CREATE TABLE care_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  caregiver_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL, -- e.g. "fille", "fils", "aide-soignant"
  alert_level alert_level NOT NULL DEFAULT 'info',
  daily_report BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(patient_user_id, caregiver_user_id)
);

-- RLS
ALTER TABLE care_contacts ENABLE ROW LEVEL SECURITY;

-- Patient can see their own care contacts
CREATE POLICY care_select_patient ON care_contacts
  FOR SELECT USING (auth.uid() = patient_user_id);

-- Caregiver can see contacts where they are caregiver
CREATE POLICY care_select_caregiver ON care_contacts
  FOR SELECT USING (auth.uid() = caregiver_user_id);

-- Caregiver can read patient conversations (for monitoring)
CREATE POLICY conv_select_caregiver ON conversations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM care_contacts cc
      WHERE cc.caregiver_user_id = auth.uid()
      AND cc.patient_user_id = conversations.user_id
    )
  );

-- Caregiver can read patient memories
CREATE POLICY mem_select_caregiver ON memories
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM care_contacts cc
      WHERE cc.caregiver_user_id = auth.uid()
      AND cc.patient_user_id = memories.user_id
    )
  );
