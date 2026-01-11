-- Create batted_ball_events table for normalized practice data with Statcast-style metrics
CREATE TABLE public.batted_ball_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.launch_monitor_sessions(id) ON DELETE CASCADE,
  event_date DATE NOT NULL,
  source VARCHAR(50) NOT NULL, -- hittrax, trackman, rapsodo, etc.
  
  -- Raw metrics
  exit_velocity DECIMAL(5,1),
  launch_angle DECIMAL(5,1),
  distance INTEGER,
  spray_angle DECIMAL(5,1),
  hang_time DECIMAL(4,2),
  
  -- Derived Statcast-style tags
  is_hard_hit BOOLEAN GENERATED ALWAYS AS (exit_velocity >= 95) STORED,
  is_sweet_spot BOOLEAN GENERATED ALWAYS AS (launch_angle >= 8 AND launch_angle <= 32) STORED,
  is_barrel BOOLEAN GENERATED ALWAYS AS (
    exit_velocity >= 98 AND 
    launch_angle >= 8 AND 
    launch_angle <= 32 AND
    exit_velocity >= 98 + (launch_angle - 8) * 0.5
  ) STORED,
  
  -- Batted ball type classification
  bb_type VARCHAR(10) GENERATED ALWAYS AS (
    CASE 
      WHEN launch_angle < 10 THEN 'GB'
      WHEN launch_angle >= 10 AND launch_angle < 25 THEN 'LD'
      WHEN launch_angle >= 25 AND launch_angle < 50 THEN 'FB'
      WHEN launch_angle >= 50 THEN 'PU'
      ELSE 'UNK'
    END
  ) STORED,
  
  -- Contact quality score (configurable weights)
  contact_score DECIMAL(4,1),
  
  -- Result outcome
  result VARCHAR(50),
  hit_type VARCHAR(20),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create player_external_profiles table for web-scraped data
CREATE TABLE public.player_external_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
  source VARCHAR(50) NOT NULL, -- savant, fangraphs, baseball_reference, roster_bio
  profile_url TEXT,
  external_player_id VARCHAR(50), -- MLB ID, FanGraphs ID, etc.
  last_scraped_at TIMESTAMPTZ,
  scrape_status VARCHAR(20) DEFAULT 'pending', -- pending, success, failed, not_found
  raw_json JSONB,
  parsed_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(player_id, source)
);

-- Create practice_summary_30d view for quick stats
CREATE OR REPLACE VIEW public.practice_summary_30d AS
SELECT 
  player_id,
  COUNT(*) AS total_events,
  ROUND(AVG(exit_velocity)::numeric, 1) AS avg_ev,
  ROUND(AVG(launch_angle)::numeric, 1) AS avg_la,
  ROUND(100.0 * SUM(CASE WHEN is_hard_hit THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) AS hard_hit_pct,
  ROUND(100.0 * SUM(CASE WHEN is_sweet_spot THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) AS sweet_spot_pct,
  ROUND(100.0 * SUM(CASE WHEN is_barrel THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) AS barrel_pct,
  ROUND(AVG(contact_score)::numeric, 1) AS avg_contact_score,
  ROUND(100.0 * SUM(CASE WHEN bb_type = 'GB' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) AS gb_pct,
  ROUND(100.0 * SUM(CASE WHEN bb_type = 'LD' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) AS ld_pct,
  ROUND(100.0 * SUM(CASE WHEN bb_type = 'FB' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) AS fb_pct
FROM public.batted_ball_events
WHERE event_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY player_id;

-- Create indexes for performance
CREATE INDEX idx_batted_ball_events_player_date ON public.batted_ball_events(player_id, event_date DESC);
CREATE INDEX idx_batted_ball_events_session ON public.batted_ball_events(session_id);
CREATE INDEX idx_player_external_profiles_player ON public.player_external_profiles(player_id);
CREATE INDEX idx_player_external_profiles_source ON public.player_external_profiles(source);

-- Enable RLS
ALTER TABLE public.batted_ball_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_external_profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies for batted_ball_events
CREATE POLICY "Admins have full access to batted_ball_events"
  ON public.batted_ball_events FOR ALL
  USING (public.is_admin());

CREATE POLICY "Players can view own batted ball events"
  ON public.batted_ball_events FOR SELECT
  USING (player_id IN (SELECT id FROM public.players WHERE email = auth.jwt()->>'email'));

-- RLS policies for player_external_profiles
CREATE POLICY "Admins have full access to player_external_profiles"
  ON public.player_external_profiles FOR ALL
  USING (public.is_admin());

CREATE POLICY "Players can view own external profiles"
  ON public.player_external_profiles FOR SELECT
  USING (player_id IN (SELECT id FROM public.players WHERE email = auth.jwt()->>'email'));

-- Trigger for updated_at
CREATE TRIGGER update_player_external_profiles_updated_at
  BEFORE UPDATE ON public.player_external_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add external ID columns to players table for linking
ALTER TABLE public.players 
  ADD COLUMN IF NOT EXISTS mlb_id VARCHAR(20),
  ADD COLUMN IF NOT EXISTS fangraphs_id VARCHAR(20),
  ADD COLUMN IF NOT EXISTS bbref_id VARCHAR(50);