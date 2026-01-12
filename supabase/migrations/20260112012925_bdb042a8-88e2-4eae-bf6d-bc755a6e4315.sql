-- ===========================================
-- Video Analyzer Tables for 4B Swing Analysis
-- ===========================================

-- 1. Video Swing Sessions: Main session container
CREATE TABLE public.video_swing_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  video_url TEXT,
  source TEXT DEFAULT 'player_upload' CHECK (source IN ('player_upload', 'admin_upload', 'coach_upload')),
  context TEXT DEFAULT 'practice' CHECK (context IN ('practice', 'game', 'cage', 'lesson', 'other')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'analyzed', 'error')),
  video_count INTEGER DEFAULT 0,
  analyzed_count INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Video Swing Events: Phase markers (load, trigger, contact, finish)
CREATE TABLE public.video_swing_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  swing_session_id UUID NOT NULL REFERENCES public.video_swing_sessions(id) ON DELETE CASCADE,
  phase TEXT NOT NULL CHECK (phase IN ('load', 'trigger', 'contact', 'finish', 'custom')),
  time_ms INTEGER NOT NULL,
  frame_index INTEGER,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Video Swing Masks: SAM3 segmentation masks
CREATE TABLE public.video_swing_masks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  swing_session_id UUID NOT NULL REFERENCES public.video_swing_sessions(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.video_swing_events(id) ON DELETE SET NULL,
  mask_type TEXT NOT NULL CHECK (mask_type IN ('hitter', 'bat', 'barrel', 'background', 'custom')),
  mask_url TEXT NOT NULL,
  frame_time_ms INTEGER NOT NULL,
  prompt_points JSONB,
  prompt_box JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Video Swing Metrics: Individual measurements
CREATE TABLE public.video_swing_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  swing_session_id UUID NOT NULL REFERENCES public.video_swing_sessions(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  metric_units TEXT,
  phase TEXT,
  source TEXT DEFAULT 'video' CHECK (source IN ('video', '4B_proxy', 'manual', 'computed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Video Swing Scores: Aggregated 4B scoring
CREATE TABLE public.video_swing_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  swing_session_id UUID NOT NULL REFERENCES public.video_swing_sessions(id) ON DELETE CASCADE,
  sequence_score INTEGER CHECK (sequence_score >= 0 AND sequence_score <= 100),
  barrel_quality_score INTEGER CHECK (barrel_quality_score >= 0 AND barrel_quality_score <= 100),
  contact_optimization_score INTEGER CHECK (contact_optimization_score >= 0 AND contact_optimization_score <= 100),
  sequence_match BOOLEAN DEFAULT false,
  sequence_order TEXT[],
  sequence_errors JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Video Swings: Individual swing videos within a session
CREATE TABLE public.video_swings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.video_swing_sessions(id) ON DELETE CASCADE,
  swing_index INTEGER NOT NULL DEFAULT 0,
  video_storage_path TEXT,
  video_url TEXT,
  thumbnail_url TEXT,
  duration_seconds NUMERIC,
  frame_rate INTEGER,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'uploading', 'uploaded', 'processing', 'analyzed', 'error')),
  sequence_analysis JSONB,
  sequence_score INTEGER,
  sequence_errors JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================================
-- Indexes for Performance
-- ===========================================
CREATE INDEX idx_video_swing_sessions_player_id ON public.video_swing_sessions(player_id);
CREATE INDEX idx_video_swing_sessions_date ON public.video_swing_sessions(session_date DESC);
CREATE INDEX idx_video_swing_sessions_status ON public.video_swing_sessions(status);
CREATE INDEX idx_video_swing_events_session_id ON public.video_swing_events(swing_session_id);
CREATE INDEX idx_video_swing_masks_session_id ON public.video_swing_masks(swing_session_id);
CREATE INDEX idx_video_swing_metrics_session_id ON public.video_swing_metrics(swing_session_id);
CREATE INDEX idx_video_swing_scores_session_id ON public.video_swing_scores(swing_session_id);
CREATE INDEX idx_video_swings_session_id ON public.video_swings(session_id);

-- ===========================================
-- Updated_at Triggers
-- ===========================================
CREATE TRIGGER update_video_swing_sessions_updated_at
  BEFORE UPDATE ON public.video_swing_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_video_swings_updated_at
  BEFORE UPDATE ON public.video_swings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ===========================================
-- Row Level Security
-- ===========================================

-- Enable RLS on all tables
ALTER TABLE public.video_swing_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_swing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_swing_masks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_swing_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_swing_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_swings ENABLE ROW LEVEL SECURITY;

-- Admins have full access
CREATE POLICY "Admins can manage video_swing_sessions"
  ON public.video_swing_sessions FOR ALL
  USING (is_admin());

CREATE POLICY "Admins can manage video_swing_events"
  ON public.video_swing_events FOR ALL
  USING (is_admin());

CREATE POLICY "Admins can manage video_swing_masks"
  ON public.video_swing_masks FOR ALL
  USING (is_admin());

CREATE POLICY "Admins can manage video_swing_metrics"
  ON public.video_swing_metrics FOR ALL
  USING (is_admin());

CREATE POLICY "Admins can manage video_swing_scores"
  ON public.video_swing_scores FOR ALL
  USING (is_admin());

CREATE POLICY "Admins can manage video_swings"
  ON public.video_swings FOR ALL
  USING (is_admin());

-- Service role has full access
CREATE POLICY "Service role full access to video_swing_sessions"
  ON public.video_swing_sessions FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to video_swing_events"
  ON public.video_swing_events FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to video_swing_masks"
  ON public.video_swing_masks FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to video_swing_metrics"
  ON public.video_swing_metrics FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to video_swing_scores"
  ON public.video_swing_scores FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to video_swings"
  ON public.video_swings FOR ALL
  USING (auth.role() = 'service_role');

-- Players can view their own video sessions
CREATE POLICY "Players can view own video_swing_sessions"
  ON public.video_swing_sessions FOR SELECT
  USING (player_id IN (
    SELECT id FROM public.players WHERE email = (auth.jwt() ->> 'email')
  ));

CREATE POLICY "Players can insert own video_swing_sessions"
  ON public.video_swing_sessions FOR INSERT
  WITH CHECK (player_id IN (
    SELECT id FROM public.players WHERE email = (auth.jwt() ->> 'email')
  ));

-- Players can view events/masks/metrics/scores for their sessions
CREATE POLICY "Players can view own video_swing_events"
  ON public.video_swing_events FOR SELECT
  USING (swing_session_id IN (
    SELECT id FROM public.video_swing_sessions WHERE player_id IN (
      SELECT id FROM public.players WHERE email = (auth.jwt() ->> 'email')
    )
  ));

CREATE POLICY "Players can view own video_swing_masks"
  ON public.video_swing_masks FOR SELECT
  USING (swing_session_id IN (
    SELECT id FROM public.video_swing_sessions WHERE player_id IN (
      SELECT id FROM public.players WHERE email = (auth.jwt() ->> 'email')
    )
  ));

CREATE POLICY "Players can view own video_swing_metrics"
  ON public.video_swing_metrics FOR SELECT
  USING (swing_session_id IN (
    SELECT id FROM public.video_swing_sessions WHERE player_id IN (
      SELECT id FROM public.players WHERE email = (auth.jwt() ->> 'email')
    )
  ));

CREATE POLICY "Players can view own video_swing_scores"
  ON public.video_swing_scores FOR SELECT
  USING (swing_session_id IN (
    SELECT id FROM public.video_swing_sessions WHERE player_id IN (
      SELECT id FROM public.players WHERE email = (auth.jwt() ->> 'email')
    )
  ));

CREATE POLICY "Players can view own video_swings"
  ON public.video_swings FOR SELECT
  USING (session_id IN (
    SELECT id FROM public.video_swing_sessions WHERE player_id IN (
      SELECT id FROM public.players WHERE email = (auth.jwt() ->> 'email')
    )
  ));

CREATE POLICY "Players can insert own video_swings"
  ON public.video_swings FOR INSERT
  WITH CHECK (session_id IN (
    SELECT id FROM public.video_swing_sessions WHERE player_id IN (
      SELECT id FROM public.players WHERE email = (auth.jwt() ->> 'email')
    )
  ));