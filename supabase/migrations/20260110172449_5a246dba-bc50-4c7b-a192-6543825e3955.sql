-- Create hittrax_sessions table for storing batted ball data
CREATE TABLE public.hittrax_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  total_swings INTEGER NOT NULL,
  
  -- Contact Metrics
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
  
  -- Quality Metrics
  quality_hits INTEGER DEFAULT 0,
  barrel_hits INTEGER DEFAULT 0,
  quality_hit_pct DECIMAL(5,2),
  barrel_pct DECIMAL(5,2),
  
  -- Quality Hit Game Scoring
  total_points INTEGER DEFAULT 0,
  points_per_swing DECIMAL(5,1),
  ball_score INTEGER CHECK (ball_score BETWEEN 20 AND 80),
  
  -- Results breakdown (JSON)
  results_breakdown JSONB,
  hit_types_breakdown JSONB,
  
  -- File reference
  source_file_path TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.hittrax_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Service role full access to hittrax_sessions"
ON public.hittrax_sessions FOR ALL
USING (auth.role() = 'service_role');

CREATE POLICY "Admins can manage hittrax_sessions"
ON public.hittrax_sessions FOR ALL
USING (is_admin());

-- Indexes
CREATE INDEX idx_hittrax_sessions_player ON public.hittrax_sessions(player_id);
CREATE INDEX idx_hittrax_sessions_date ON public.hittrax_sessions(session_date);

-- Add columns to players table if not exist
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS latest_ball_score INTEGER;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS latest_hittrax_session_id UUID REFERENCES public.hittrax_sessions(id);

-- Trigger for updated_at
CREATE TRIGGER update_hittrax_sessions_updated_at
BEFORE UPDATE ON public.hittrax_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();