
-- 4B Scoring Engine v2 — Schema Update

-- 1. SCORING VERSION
ALTER TABLE player_sessions
  ADD COLUMN IF NOT EXISTS scoring_version TEXT
    NOT NULL DEFAULT 'v1_legacy'
    CHECK (scoring_version IN ('v1_legacy', 'v2'));

COMMENT ON COLUMN player_sessions.scoring_version IS
  'v1_legacy = pre-refactor client-side scoring; v2 = server-side unified engine (March 2026+)';

-- 2. CANONICAL COLUMN NAMES
ALTER TABLE player_sessions
  ADD COLUMN IF NOT EXISTS score_4bkrs INTEGER;

COMMENT ON COLUMN player_sessions.score_4bkrs IS
  'Canonical composite 4BKRS score (0–100). Replaces: krs, total, composite.';

ALTER TABLE player_sessions
  ADD COLUMN IF NOT EXISTS scoring_mode TEXT
    CHECK (scoring_mode IN ('full', 'training'));

COMMENT ON COLUMN player_sessions.scoring_mode IS
  'full = Ball pillar present; training = no outcome data, weights redistributed';

ALTER TABLE player_sessions
  ADD COLUMN IF NOT EXISTS body_score  NUMERIC(5,1),
  ADD COLUMN IF NOT EXISTS brain_score NUMERIC(5,1),
  ADD COLUMN IF NOT EXISTS bat_score   NUMERIC(5,1),
  ADD COLUMN IF NOT EXISTS ball_score  NUMERIC(5,1);

ALTER TABLE player_sessions
  ADD COLUMN IF NOT EXISTS creation_score NUMERIC(5,1),
  ADD COLUMN IF NOT EXISTS transfer_score NUMERIC(5,1);

ALTER TABLE player_sessions
  ADD COLUMN IF NOT EXISTS transfer_ratio   NUMERIC(6,3),
  ADD COLUMN IF NOT EXISTS timing_gap_pct   NUMERIC(5,1),
  ADD COLUMN IF NOT EXISTS bat_speed_mph    NUMERIC(5,1),
  ADD COLUMN IF NOT EXISTS exit_velocity_mph NUMERIC(5,1);

ALTER TABLE player_sessions
  ADD COLUMN IF NOT EXISTS rating TEXT
    CHECK (rating IN ('Elite', 'Good', 'Working', 'Priority')),
  ADD COLUMN IF NOT EXISTS rating_color TEXT;

-- 3. PREDICTED vs ACTUAL
ALTER TABLE player_sessions
  ADD COLUMN IF NOT EXISTS predicted_bat_speed_mph    NUMERIC(5,1),
  ADD COLUMN IF NOT EXISTS predicted_exit_velocity_mph NUMERIC(5,1),
  ADD COLUMN IF NOT EXISTS predicted_entry_bucket     TEXT,
  ADD COLUMN IF NOT EXISTS actual_bat_speed_mph       NUMERIC(5,1),
  ADD COLUMN IF NOT EXISTS actual_exit_velocity_mph   NUMERIC(5,1),
  ADD COLUMN IF NOT EXISTS actual_entry_bucket        TEXT;

COMMENT ON COLUMN player_sessions.predicted_entry_bucket IS
  'BBA bucket predicted from mechanics: Shallow-Steep | Deep-Steep | Shallow-Flat | Deep-Flat';

-- 4. SCORING TIMESTAMP
ALTER TABLE player_sessions
  ADD COLUMN IF NOT EXISTS scoring_timestamp TIMESTAMPTZ;

COMMENT ON COLUMN player_sessions.scoring_timestamp IS
  'When the v2 scoring engine last computed scores for this session';

-- 5. INDEXES
CREATE INDEX IF NOT EXISTS idx_player_sessions_scoring_version
  ON player_sessions (scoring_version);

CREATE INDEX IF NOT EXISTS idx_player_sessions_player_version_ts
  ON player_sessions (player_id, scoring_version, scoring_timestamp DESC)
  WHERE scoring_timestamp IS NOT NULL;

-- 6. BACKFILL HELPER VIEW
CREATE OR REPLACE VIEW sessions_pending_v2_scoring AS
SELECT
  id             AS session_id,
  player_id,
  created_at,
  scoring_version,
  score_4bkrs    AS current_score,
  scoring_timestamp
FROM player_sessions
WHERE scoring_version = 'v1_legacy'
   OR scoring_version IS NULL
ORDER BY created_at DESC;

COMMENT ON VIEW sessions_pending_v2_scoring IS
  'Sessions not yet processed by the v2 scoring engine. Feed to backfill-4b-scores.';
