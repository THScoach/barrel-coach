-- Create launch_monitor_sessions table (replaces hittrax_sessions concept but keeps existing table)
CREATE TABLE IF NOT EXISTS launch_monitor_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  
  -- Source tracking
  source TEXT NOT NULL, -- 'hittrax', 'trackman', 'rapsodo', 'flightscope', 'diamond-kinetics', 'generic'
  source_file_name TEXT,
  
  -- Counts
  total_swings INTEGER NOT NULL,
  misses INTEGER DEFAULT 0,
  fouls INTEGER DEFAULT 0,
  balls_in_play INTEGER DEFAULT 0,
  contact_rate DECIMAL(5,2),
  
  -- Exit Velocity
  avg_exit_velo DECIMAL(5,1),
  max_exit_velo DECIMAL(5,1),
  min_exit_velo DECIMAL(5,1),
  velo_90_plus INTEGER DEFAULT 0,
  velo_95_plus INTEGER DEFAULT 0,
  velo_100_plus INTEGER DEFAULT 0,
  
  -- Launch Angle
  avg_launch_angle DECIMAL(5,1),
  optimal_la_count INTEGER DEFAULT 0,
  ground_ball_count INTEGER DEFAULT 0,
  fly_ball_count INTEGER DEFAULT 0,
  
  -- Distance
  max_distance INTEGER,
  avg_distance INTEGER,
  
  -- Quality Hit Game Scores
  quality_hits INTEGER DEFAULT 0,
  barrel_hits INTEGER DEFAULT 0,
  quality_hit_pct DECIMAL(5,2),
  barrel_pct DECIMAL(5,2),
  total_points INTEGER DEFAULT 0,
  points_per_swing DECIMAL(5,1),
  ball_score INTEGER,
  
  -- Raw data
  results_breakdown JSONB,
  hit_types_breakdown JSONB,
  raw_swings JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_launch_monitor_player ON launch_monitor_sessions(player_id);
CREATE INDEX idx_launch_monitor_date ON launch_monitor_sessions(session_date DESC);

-- Enable RLS
ALTER TABLE launch_monitor_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Service role full access to launch_monitor_sessions"
  ON launch_monitor_sessions FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Admins can manage launch_monitor_sessions"
  ON launch_monitor_sessions FOR ALL
  USING (is_admin());

-- Create reboot_uploads table for manual CSV uploads
CREATE TABLE IF NOT EXISTS reboot_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  
  -- File tracking
  ik_file_uploaded BOOLEAN DEFAULT false,
  me_file_uploaded BOOLEAN DEFAULT false,
  
  -- 4B Scores (20-80 scale)
  brain_score INTEGER,
  body_score INTEGER,
  bat_score INTEGER,
  composite_score DECIMAL(4,1),
  grade TEXT,
  
  -- Sub-scores
  ground_flow_score INTEGER,
  core_flow_score INTEGER,
  upper_flow_score INTEGER,
  
  -- Key Metrics
  pelvis_velocity DECIMAL(6,2),
  torso_velocity DECIMAL(6,2),
  x_factor DECIMAL(5,2),
  bat_ke DECIMAL(6,2),
  transfer_efficiency DECIMAL(5,2),
  consistency_cv DECIMAL(5,2),
  consistency_grade TEXT,
  
  -- Analysis
  weakest_link TEXT,
  
  -- Raw data
  ik_data JSONB,
  me_data JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reboot_uploads_player ON reboot_uploads(player_id);
CREATE INDEX idx_reboot_uploads_date ON reboot_uploads(session_date DESC);

-- Enable RLS
ALTER TABLE reboot_uploads ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Service role full access to reboot_uploads"
  ON reboot_uploads FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Admins can manage reboot_uploads"
  ON reboot_uploads FOR ALL
  USING (is_admin());

-- Add latest score columns to players table
ALTER TABLE players ADD COLUMN IF NOT EXISTS latest_brain_score INTEGER;
ALTER TABLE players ADD COLUMN IF NOT EXISTS latest_body_score INTEGER;
ALTER TABLE players ADD COLUMN IF NOT EXISTS latest_bat_score INTEGER;
ALTER TABLE players ADD COLUMN IF NOT EXISTS latest_composite_score DECIMAL(4,1);