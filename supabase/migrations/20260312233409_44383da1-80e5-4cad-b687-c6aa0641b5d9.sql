
-- Add scoring metadata columns to player_sessions
ALTER TABLE player_sessions 
  ADD COLUMN IF NOT EXISTS scored_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scoring_version VARCHAR(20),
  ADD COLUMN IF NOT EXISTS creation_score DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS transfer_score DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS transfer_ratio DECIMAL(4,2),
  ADD COLUMN IF NOT EXISTS timing_gap_pct DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS x_factor_max DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS tempo_ratio DECIMAL(4,2),
  ADD COLUMN IF NOT EXISTS sequence_order VARCHAR(50),
  ADD COLUMN IF NOT EXISTS weakest_link VARCHAR(50),
  ADD COLUMN IF NOT EXISTS coaching_summary TEXT,
  ADD COLUMN IF NOT EXISTS flags JSONB DEFAULT '[]';

-- Index for fast progression queries
CREATE INDEX IF NOT EXISTS idx_sessions_player_date 
  ON player_sessions(player_id, session_date DESC);

-- Index for finding unscored sessions
CREATE INDEX IF NOT EXISTS idx_sessions_scored 
  ON player_sessions(scored_at) WHERE scored_at IS NULL;
