-- Add fields for in-person workflow to sessions table
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS payment_link_id TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS payment_link_url TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS is_in_person BOOLEAN DEFAULT false;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS player_notes TEXT;

-- Add index for in-person sessions
CREATE INDEX IF NOT EXISTS idx_sessions_in_person ON sessions(is_in_person) WHERE is_in_person = true;