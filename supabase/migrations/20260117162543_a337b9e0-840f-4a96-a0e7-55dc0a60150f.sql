-- Create video_2d_sessions table for Gemini 2D video analysis
-- Completely separate from reboot_uploads (3D biomechanics)

CREATE TABLE public.video_2d_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
  
  -- Video info
  video_url TEXT NOT NULL,
  video_filename TEXT,
  video_storage_path TEXT,
  camera_angle VARCHAR(50),
  video_quality VARCHAR(20),
  frame_rate INTEGER,
  
  -- Session metadata
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  context VARCHAR(100),
  upload_source VARCHAR(50) DEFAULT 'player_upload',
  
  -- 4B Scores (2D estimated - capped)
  composite_score NUMERIC,
  body_score INTEGER,
  brain_score INTEGER, -- Max 55 for 2D
  bat_score INTEGER,
  ball_score INTEGER, -- Max 50 for 2D
  grade TEXT,
  
  -- Analysis results
  leak_detected VARCHAR(50),
  leak_evidence TEXT,
  motor_profile VARCHAR(50),
  motor_profile_evidence TEXT,
  priority_drill TEXT,
  coach_rick_take TEXT,
  
  -- Full analysis JSON from Gemini
  analysis_json JSONB,
  analysis_confidence NUMERIC,
  
  -- Processing status
  processing_status VARCHAR(20) DEFAULT 'pending',
  error_message TEXT,
  
  -- Upgrade path tracking
  is_paid_user BOOLEAN DEFAULT false,
  pending_3d_analysis BOOLEAN DEFAULT false,
  upgraded_to_3d_at TIMESTAMP WITH TIME ZONE,
  reboot_upload_id UUID REFERENCES public.reboot_uploads(id),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.video_2d_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage video_2d_sessions"
  ON public.video_2d_sessions FOR ALL
  USING (is_admin());

CREATE POLICY "Service role full access to video_2d_sessions"
  ON public.video_2d_sessions FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Players can view own 2D sessions"
  ON public.video_2d_sessions FOR SELECT
  USING (player_id IN (
    SELECT id FROM players WHERE email = (auth.jwt() ->> 'email')
  ));

CREATE POLICY "Players can insert own 2D sessions"
  ON public.video_2d_sessions FOR INSERT
  WITH CHECK (player_id IN (
    SELECT id FROM players WHERE email = (auth.jwt() ->> 'email')
  ));

-- Index for player lookups
CREATE INDEX idx_video_2d_sessions_player_id ON public.video_2d_sessions(player_id);
CREATE INDEX idx_video_2d_sessions_created_at ON public.video_2d_sessions(created_at DESC);
CREATE INDEX idx_video_2d_sessions_pending_3d ON public.video_2d_sessions(pending_3d_analysis) WHERE pending_3d_analysis = true;

-- Trigger for updated_at
CREATE TRIGGER update_video_2d_sessions_updated_at
  BEFORE UPDATE ON public.video_2d_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment for clarity
COMMENT ON TABLE public.video_2d_sessions IS 'Stores 2D video analysis results from Gemini Vision. Separate from reboot_uploads which is for 3D biomechanics data only.';