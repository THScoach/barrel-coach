-- Reference Athletes table for PRO/internal validation data
CREATE TABLE public.reference_athletes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  display_name TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('MLB', 'MiLB', 'NCAA', 'Indy', 'International')),
  handedness TEXT CHECK (handedness IN ('R', 'L', 'S')),
  archetype TEXT,
  notes TEXT,
  visibility TEXT NOT NULL DEFAULT 'internal_only' CHECK (visibility IN ('internal_only', 'coach_only')),
  reboot_athlete_id TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Reference Sessions table for storing their Reboot data
CREATE TABLE public.reference_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reference_athlete_id UUID NOT NULL REFERENCES public.reference_athletes(id) ON DELETE CASCADE,
  reboot_session_id TEXT,
  captured_at TIMESTAMP WITH TIME ZONE,
  session_date DATE,
  source TEXT NOT NULL DEFAULT 'reboot' CHECK (source IN ('reboot', 'manual', 'dk')),
  
  -- Raw metrics JSON from source
  metrics_json JSONB,
  
  -- Computed 4B scores (same structure as swing_4b_scores)
  body_score INTEGER,
  brain_score INTEGER,
  bat_score INTEGER,
  ball_score INTEGER,
  composite_score NUMERIC,
  
  -- Biomechanics metrics
  pelvis_velocity NUMERIC,
  torso_velocity NUMERIC,
  x_factor NUMERIC,
  transfer_efficiency NUMERIC,
  bat_ke NUMERIC,
  
  -- Flow scores
  ground_flow_score INTEGER,
  core_flow_score INTEGER,
  upper_flow_score INTEGER,
  
  -- Consistency
  consistency_cv NUMERIC,
  consistency_grade TEXT,
  weakest_link TEXT,
  grade TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reference_athletes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reference_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Admin-only access
CREATE POLICY "Admins can manage reference_athletes"
  ON public.reference_athletes FOR ALL
  USING (is_admin());

CREATE POLICY "Service role full access to reference_athletes"
  ON public.reference_athletes FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Admins can manage reference_sessions"
  ON public.reference_sessions FOR ALL
  USING (is_admin());

CREATE POLICY "Service role full access to reference_sessions"
  ON public.reference_sessions FOR ALL
  USING (auth.role() = 'service_role');

-- Add trigger for updated_at
CREATE TRIGGER update_reference_athletes_updated_at
  BEFORE UPDATE ON public.reference_athletes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reference_sessions_updated_at
  BEFORE UPDATE ON public.reference_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for common queries
CREATE INDEX idx_reference_athletes_level ON public.reference_athletes(level);
CREATE INDEX idx_reference_athletes_visibility ON public.reference_athletes(visibility);
CREATE INDEX idx_reference_sessions_athlete_id ON public.reference_sessions(reference_athlete_id);
CREATE INDEX idx_reference_sessions_captured_at ON public.reference_sessions(captured_at DESC);