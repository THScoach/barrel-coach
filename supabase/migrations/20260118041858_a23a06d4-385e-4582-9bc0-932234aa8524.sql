-- ============================================================================
-- SENSOR SESSIONS & SWINGS + GAMIFICATION TABLES
-- For Diamond Kinetics integration with Kwon-style analysis
-- ============================================================================

-- ============================================
-- SENSOR SESSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS sensor_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  dk_session_uuid VARCHAR(100) UNIQUE,
  total_swings INTEGER DEFAULT 0,
  bat_speed_max DECIMAL(5,2),
  bat_speed_avg DECIMAL(5,2),
  hand_speed_max DECIMAL(5,2),
  avg_bat_speed DECIMAL(5,2),
  max_bat_speed DECIMAL(5,2),
  avg_hand_to_bat_ratio DECIMAL(5,2),
  timing_variance_pct DECIMAL(5,2),
  kinetic_fingerprint_json JSONB,
  attack_angle_avg DECIMAL(5,2),
  attack_direction_avg DECIMAL(5,2),
  timing_variance DECIMAL(5,4),
  four_b_bat DECIMAL(5,2),
  four_b_brain DECIMAL(5,2),
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  duration_minutes INTEGER,
  environment VARCHAR(20) CHECK (environment IN ('tee', 'soft_toss', 'front_toss', 'bp', 'machine', 'live', 'unknown')),
  video_url TEXT,
  video_storage_path TEXT,
  status VARCHAR(20) DEFAULT 'syncing' CHECK (status IN ('syncing', 'complete', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ
);

-- ============================================
-- SENSOR SWINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS sensor_swings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sensor_sessions(id) ON DELETE CASCADE,
  dk_swing_id TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  swing_number INTEGER,
  bat_speed_mph DECIMAL(5,1),
  hand_speed_mph DECIMAL(5,1),
  trigger_to_impact_ms INTEGER,
  attack_angle_deg DECIMAL(5,1),
  attack_direction_deg DECIMAL(5,1),
  swing_plane_tilt_deg DECIMAL(5,1),
  impact_location_x DECIMAL(5,3),
  impact_location_y DECIMAL(5,3),
  impact_location_z DECIMAL(5,3),
  applied_power DECIMAL(8,1),
  max_acceleration DECIMAL(8,1),
  hand_to_bat_ratio DECIMAL(5,2),
  is_valid BOOLEAN DEFAULT TRUE,
  invalid_reason VARCHAR(50),
  warnings TEXT[],
  raw_dk_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_sensor_swings_dk_id ON sensor_swings(player_id, dk_swing_id) WHERE dk_swing_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_sensor_swings_composite ON sensor_swings(player_id, session_id, occurred_at, bat_speed_mph, swing_number);
CREATE INDEX IF NOT EXISTS idx_sensor_swings_session ON sensor_swings(session_id);
CREATE INDEX IF NOT EXISTS idx_sensor_swings_player_date ON sensor_swings(player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sensor_swings_player_valid ON sensor_swings(player_id, is_valid) WHERE is_valid = TRUE;
CREATE INDEX IF NOT EXISTS idx_sensor_sessions_player ON sensor_sessions(player_id);
CREATE INDEX IF NOT EXISTS idx_sensor_sessions_date ON sensor_sessions(session_date DESC);

-- ============================================
-- XP LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS xp_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  reason VARCHAR(100) NOT NULL,
  new_total INTEGER NOT NULL,
  reference_type VARCHAR(50),
  reference_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_xp_log_player ON xp_log(player_id);
CREATE INDEX IF NOT EXISTS idx_xp_log_created ON xp_log(created_at DESC);

-- ============================================
-- WEEKLY CHALLENGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS weekly_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  challenge_type VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  target_metric VARCHAR(50),
  target_value DECIMAL(10,4),
  target_type VARCHAR(20) DEFAULT 'above',
  min_swings INTEGER DEFAULT 20,
  winner_player_id UUID REFERENCES players(id),
  winner_value DECIMAL(10,4),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'complete', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_challenges_week ON weekly_challenges(week_start);

-- ============================================
-- CHALLENGE ENTRIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS challenge_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES weekly_challenges(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  current_value DECIMAL(10,4),
  swings_count INTEGER DEFAULT 0,
  is_winner BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(challenge_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_challenge_entries_player ON challenge_entries(player_id);

-- ============================================
-- KWON ANALYSES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS kwon_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sensor_sessions(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  analysis_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  swings_analyzed INTEGER NOT NULL,
  data_quality TEXT NOT NULL CHECK (data_quality IN ('excellent', 'good', 'limited')),
  motor_profile TEXT NOT NULL CHECK (motor_profile IN ('Spinner', 'Slingshotter', 'Whipper', 'Titan', 'Unknown')),
  sensor_facts JSONB NOT NULL,
  release_prediction JSONB NOT NULL,
  timing_prediction JSONB NOT NULL,
  upstream_prediction JSONB NOT NULL,
  kinetic_potential JSONB NOT NULL,
  possible_leaks JSONB NOT NULL DEFAULT '[]',
  four_b_scores JSONB NOT NULL,
  priority_focus TEXT NOT NULL,
  secondary_focus TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kwon_analyses_player_id ON kwon_analyses(player_id);
CREATE INDEX IF NOT EXISTS idx_kwon_analyses_session_id ON kwon_analyses(session_id);
CREATE INDEX IF NOT EXISTS idx_kwon_analyses_analysis_date ON kwon_analyses(analysis_date DESC);
CREATE INDEX IF NOT EXISTS idx_kwon_analyses_motor_profile ON kwon_analyses(motor_profile);

-- ============================================
-- KINETIC FINGERPRINTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS kinetic_fingerprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  intent_map JSONB NOT NULL,
  timing_signature JSONB NOT NULL,
  pattern_metrics JSONB NOT NULL,
  body_sequence JSONB,
  swing_count INTEGER NOT NULL DEFAULT 0,
  motor_profile TEXT CHECK (motor_profile IN ('Spinner', 'Slingshotter', 'Whipper', 'Titan', 'Unknown')),
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_kinetic_fingerprints_player_unique ON kinetic_fingerprints(player_id);

-- ============================================
-- KINETIC FINGERPRINT HISTORY
-- ============================================
CREATE TABLE IF NOT EXISTS kinetic_fingerprint_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  fingerprint_snapshot JSONB NOT NULL,
  swing_count INTEGER NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fingerprint_history_player ON kinetic_fingerprint_history(player_id, recorded_at DESC);

-- ============================================
-- ADD GAMIFICATION COLUMNS TO PLAYERS
-- ============================================
ALTER TABLE players ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS longest_streak INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS total_xp INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS player_level INTEGER DEFAULT 1;
ALTER TABLE players ADD COLUMN IF NOT EXISTS kinetic_fingerprint_url TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS kinetic_fingerprint_json JSONB;
ALTER TABLE players ADD COLUMN IF NOT EXISTS last_sensor_session_date DATE;
ALTER TABLE players ADD COLUMN IF NOT EXISTS sessions_this_week INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS sensor_baseline_complete BOOLEAN DEFAULT FALSE;
ALTER TABLE players ADD COLUMN IF NOT EXISTS sensor_baseline_date TIMESTAMPTZ;
ALTER TABLE players ADD COLUMN IF NOT EXISTS sensor_baseline_session_id UUID;
ALTER TABLE players ADD COLUMN IF NOT EXISTS current_bat_speed DECIMAL(5,2);
ALTER TABLE players ADD COLUMN IF NOT EXISTS motor_profile_sensor VARCHAR(30);
ALTER TABLE players ADD COLUMN IF NOT EXISTS membership_tier VARCHAR(20) DEFAULT 'Free';

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE sensor_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensor_swings ENABLE ROW LEVEL SECURITY;
ALTER TABLE xp_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE kwon_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE kinetic_fingerprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE kinetic_fingerprint_history ENABLE ROW LEVEL SECURITY;

-- Sensor sessions policies
CREATE POLICY "Sensor sessions viewable by all" ON sensor_sessions FOR SELECT USING (true);
CREATE POLICY "Sensor sessions insertable by service" ON sensor_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Sensor sessions updatable by service" ON sensor_sessions FOR UPDATE USING (true);

-- Sensor swings policies
CREATE POLICY "Sensor swings viewable by all" ON sensor_swings FOR SELECT USING (true);
CREATE POLICY "Sensor swings insertable by service" ON sensor_swings FOR INSERT WITH CHECK (true);

-- XP log policies (viewable by all since no user_id on players)
CREATE POLICY "XP log viewable by all" ON xp_log FOR SELECT USING (true);
CREATE POLICY "XP log insertable by service" ON xp_log FOR INSERT WITH CHECK (true);

-- Challenges policies
CREATE POLICY "Challenges viewable by all" ON weekly_challenges FOR SELECT USING (true);
CREATE POLICY "Challenge entries viewable by all" ON challenge_entries FOR SELECT USING (true);

-- Kwon analyses policies
CREATE POLICY "Kwon analyses viewable by all" ON kwon_analyses FOR SELECT USING (true);
CREATE POLICY "Kwon analyses insertable by service" ON kwon_analyses FOR INSERT WITH CHECK (true);

-- Fingerprints policies
CREATE POLICY "Fingerprints viewable by all" ON kinetic_fingerprints FOR SELECT USING (true);
CREATE POLICY "Fingerprints insertable by service" ON kinetic_fingerprints FOR INSERT WITH CHECK (true);
CREATE POLICY "Fingerprints updatable by service" ON kinetic_fingerprints FOR UPDATE USING (true);

CREATE POLICY "Fingerprint history viewable by all" ON kinetic_fingerprint_history FOR SELECT USING (true);
CREATE POLICY "Fingerprint history insertable by service" ON kinetic_fingerprint_history FOR INSERT WITH CHECK (true);

-- ============================================
-- FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION calculate_player_level(xp INTEGER)
RETURNS INTEGER AS $$
DECLARE
  levels INTEGER[] := ARRAY[0, 500, 1500, 3500, 7000, 12000, 20000, 35000, 55000, 80000];
  i INTEGER;
BEGIN
  FOR i IN REVERSE 10..1 LOOP
    IF xp >= levels[i] THEN
      RETURN i;
    END IF;
  END LOOP;
  RETURN 1;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION award_xp(
  p_player_id UUID,
  p_amount INTEGER,
  p_reason VARCHAR(100),
  p_reference_type VARCHAR(50) DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL
)
RETURNS TABLE(new_xp INTEGER, new_level INTEGER, leveled_up BOOLEAN) AS $$
DECLARE
  v_old_xp INTEGER;
  v_old_level INTEGER;
  v_new_xp INTEGER;
  v_new_level INTEGER;
BEGIN
  SELECT total_xp, player_level INTO v_old_xp, v_old_level
  FROM players WHERE id = p_player_id;
  
  v_old_xp := COALESCE(v_old_xp, 0);
  v_old_level := COALESCE(v_old_level, 1);
  v_new_xp := v_old_xp + p_amount;
  v_new_level := calculate_player_level(v_new_xp);
  
  UPDATE players SET
    total_xp = v_new_xp,
    player_level = v_new_level
  WHERE id = p_player_id;
  
  INSERT INTO xp_log (player_id, amount, reason, new_total, reference_type, reference_id)
  VALUES (p_player_id, p_amount, p_reason, v_new_xp, p_reference_type, p_reference_id);
  
  RETURN QUERY SELECT v_new_xp, v_new_level, (v_new_level > v_old_level);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION calculate_player_level IS
'Level progression:
  1: Rookie (0 XP)
  2: Prospect (500 XP)
  3: Contender (1,500 XP)
  4: Competitor (3,500 XP)
  5: Varsity (7,000 XP)
  6: All-Conference (12,000 XP)
  7: All-State (20,000 XP)
  8: D1 Commit (35,000 XP)
  9: Pro Prospect (55,000 XP)
  10: Barrel King (80,000 XP)';