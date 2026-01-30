-- Add missing columns to existing reboot_sessions table
ALTER TABLE reboot_sessions 
ADD COLUMN IF NOT EXISTS reboot_player_id TEXT,
ADD COLUMN IF NOT EXISTS movement_type TEXT DEFAULT 'baseball-hitting',
ADD COLUMN IF NOT EXISTS video_url TEXT,
ADD COLUMN IF NOT EXISTS last_polled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS exported_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Create reboot_exports table if not exists
CREATE TABLE IF NOT EXISTS reboot_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  data_types TEXT[] DEFAULT '{}',
  csv_data JSONB DEFAULT '{}',
  raw_response JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reboot_exports_player_id ON reboot_exports(player_id);
CREATE INDEX IF NOT EXISTS idx_reboot_exports_session_id ON reboot_exports(session_id);

-- Enable RLS and policies
ALTER TABLE reboot_exports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on reboot_exports" ON reboot_exports;
CREATE POLICY "Service role full access on reboot_exports"
ON reboot_exports FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- Update existing view for processing sessions
CREATE OR REPLACE VIEW processing_sessions AS
SELECT
  rs.id,
  rs.reboot_session_id,
  rs.status,
  rs.created_at,
  rs.last_polled_at,
  p.name as player_name,
  EXTRACT(EPOCH FROM (NOW() - rs.created_at)) / 60 as minutes_since_upload
FROM reboot_sessions rs
JOIN players p ON rs.player_id = p.id
WHERE rs.status IN ('pending', 'processing')
ORDER BY rs.created_at ASC;