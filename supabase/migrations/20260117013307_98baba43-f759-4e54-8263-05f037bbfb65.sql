-- Create swing_analysis table for Reboot Motion analysis results
CREATE TABLE public.swing_analysis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
  session_id UUID,
  movement_id TEXT NOT NULL,
  
  -- Timing/frame info
  frame_rate INTEGER,
  duration_seconds NUMERIC,
  event_contact_frame INTEGER,
  
  -- Peak frame indices
  pelvis_vel_peak_frame INTEGER,
  torso_vel_peak_frame INTEGER,
  arms_vel_peak_frame INTEGER,
  
  -- Core timing metrics
  transfer_ratio NUMERIC,
  transfer_ratio_rating VARCHAR(20),
  peak_timing_gap_ms INTEGER,
  peak_timing_gap_pct NUMERIC,
  whip_timing_pct NUMERIC,
  
  -- Deceleration flags
  pelvis_decel_before_contact BOOLEAN DEFAULT false,
  torso_decel_before_contact BOOLEAN DEFAULT false,
  arms_decel_before_contact BOOLEAN DEFAULT false,
  all_segments_decel BOOLEAN DEFAULT false,
  
  -- Kinematic sequence
  sequence VARCHAR(20),
  sequence_correct BOOLEAN DEFAULT false,
  
  -- X-Factor (from IK data)
  x_factor_max NUMERIC,
  x_factor_at_contact NUMERIC,
  
  -- Motor profile classification
  motor_profile VARCHAR(30),
  motor_profile_confidence NUMERIC,
  spinner_score INTEGER DEFAULT 0,
  whipper_score INTEGER DEFAULT 0,
  slingshotter_score INTEGER DEFAULT 0,
  titan_score INTEGER DEFAULT 0,
  
  -- Data quality
  data_quality_flags TEXT[],
  reboot_file_path TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create swing_flags table for issues detected during analysis
CREATE TABLE public.swing_flags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  swing_id UUID NOT NULL REFERENCES public.swing_analysis(id) ON DELETE CASCADE,
  flag_type VARCHAR(50) NOT NULL,
  segment VARCHAR(30),
  severity VARCHAR(20) DEFAULT 'info',
  message TEXT,
  pillar VARCHAR(20),
  drill_tags TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.swing_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swing_flags ENABLE ROW LEVEL SECURITY;

-- RLS policies for swing_analysis
CREATE POLICY "Admins can manage all swing analysis"
  ON public.swing_analysis FOR ALL
  USING (public.is_admin());

CREATE POLICY "Players can view their own swing analysis"
  ON public.swing_analysis FOR SELECT
  USING (player_id IN (
    SELECT id FROM public.players WHERE email = auth.jwt()->>'email'
  ));

-- RLS policies for swing_flags
CREATE POLICY "Admins can manage all swing flags"
  ON public.swing_flags FOR ALL
  USING (public.is_admin());

CREATE POLICY "Players can view flags for their swings"
  ON public.swing_flags FOR SELECT
  USING (swing_id IN (
    SELECT sa.id FROM public.swing_analysis sa
    JOIN public.players p ON sa.player_id = p.id
    WHERE p.email = auth.jwt()->>'email'
  ));

-- Indexes
CREATE INDEX idx_swing_analysis_player_id ON public.swing_analysis(player_id);
CREATE INDEX idx_swing_analysis_session_id ON public.swing_analysis(session_id);
CREATE INDEX idx_swing_analysis_motor_profile ON public.swing_analysis(motor_profile);
CREATE INDEX idx_swing_flags_swing_id ON public.swing_flags(swing_id);
CREATE INDEX idx_swing_flags_flag_type ON public.swing_flags(flag_type);

-- Trigger for updated_at
CREATE TRIGGER update_swing_analysis_updated_at
  BEFORE UPDATE ON public.swing_analysis
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();