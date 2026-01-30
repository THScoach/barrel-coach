-- Stack Training Data Storage
CREATE TABLE public.stack_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Program Info
  program_name TEXT,
  program_status TEXT CHECK (program_status IN ('in_progress', 'complete', 'paused')),
  total_sessions INTEGER DEFAULT 0,
  total_swings INTEGER DEFAULT 0,
  
  -- Bat Speed Tracking
  bat_speed_start NUMERIC(5,1),
  bat_speed_current NUMERIC(5,1),
  bat_speed_peak NUMERIC(5,1),
  bat_speed_history JSONB DEFAULT '[]'::jsonb,
  
  -- Distance Potential
  distance_potential_avg NUMERIC(5,1),
  distance_potential_history JSONB DEFAULT '[]'::jsonb,
  
  -- Grit Score (BRAIN indicator)
  grit_score_avg NUMERIC(5,1),
  grit_score_variance NUMERIC(5,2),
  grit_history JSONB DEFAULT '[]'::jsonb,
  grit_notes TEXT,
  
  -- Health & Readiness
  readiness_avg NUMERIC(5,1),
  readiness_history JSONB DEFAULT '[]'::jsonb,
  
  -- Force-Velocity Profile
  fv_profile TEXT CHECK (fv_profile IN ('overspeed_responder', 'overload_responder', 'balanced', 'unknown')),
  fv_notes TEXT,
  
  -- Personal Bests by Weight
  personal_bests JSONB DEFAULT '{}'::jsonb,
  
  -- 4B Correlations (computed insights)
  four_b_insights JSONB DEFAULT '{}'::jsonb,
  
  -- Coach Notes
  coach_notes TEXT,
  insight_summary TEXT
);

-- Enable RLS
ALTER TABLE public.stack_sessions ENABLE ROW LEVEL SECURITY;

-- Policies for admin access
CREATE POLICY "Admins can manage stack sessions" 
ON public.stack_sessions 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create index for player lookups
CREATE INDEX idx_stack_sessions_player ON public.stack_sessions(player_id);
CREATE INDEX idx_stack_sessions_created ON public.stack_sessions(created_at DESC);

-- Add trigger for updated_at
CREATE TRIGGER update_stack_sessions_updated_at
BEFORE UPDATE ON public.stack_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();