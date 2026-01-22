-- Create capture_sessions table for session management
CREATE TABLE public.capture_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  total_swings INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  environment VARCHAR(20) CHECK (environment IN ('tee', 'soft_toss', 'front_toss', 'bp', 'live', 'machine')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create captured_swings table for individual swing data
CREATE TABLE public.captured_swings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.capture_sessions(id) ON DELETE CASCADE,
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
  swing_number INTEGER NOT NULL,
  video_path TEXT,
  video_url TEXT,
  thumbnail_path TEXT,
  
  -- Traditional metrics
  bat_speed_mph DECIMAL(5,1),
  attack_angle_deg DECIMAL(5,1),
  hand_speed_mph DECIMAL(5,1),
  time_to_contact_ms INTEGER,
  
  -- Catching Barrels enhanced metrics
  tempo_score INTEGER CHECK (tempo_score >= 0 AND tempo_score <= 100),
  motor_profile_prediction VARCHAR(20) CHECK (motor_profile_prediction IN ('SPINNER', 'WHIPPER', 'SLINGSHOTTER', 'TITAN', 'UNKNOWN')),
  efficiency_rating DECIMAL(4,1),
  
  -- Analysis data
  raw_sensor_data JSONB,
  analysis_result JSONB,
  peak_acceleration_g DECIMAL(5,2),
  
  -- Timestamps
  captured_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  analyzed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.capture_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.captured_swings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for capture_sessions
CREATE POLICY "Users can view their own sessions"
  ON public.capture_sessions FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() IN (
    SELECT user_id FROM public.user_roles WHERE role = 'admin'
  ));

CREATE POLICY "Users can create their own sessions"
  ON public.capture_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions"
  ON public.capture_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all sessions"
  ON public.capture_sessions FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

-- RLS Policies for captured_swings
CREATE POLICY "Users can view swings from their sessions"
  ON public.captured_swings FOR SELECT
  USING (
    session_id IN (SELECT id FROM public.capture_sessions WHERE user_id = auth.uid())
    OR auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'admin')
  );

CREATE POLICY "Users can insert swings to their sessions"
  ON public.captured_swings FOR INSERT
  WITH CHECK (
    session_id IN (SELECT id FROM public.capture_sessions WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update their own swings"
  ON public.captured_swings FOR UPDATE
  USING (
    session_id IN (SELECT id FROM public.capture_sessions WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can manage all swings"
  ON public.captured_swings FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

-- Indexes for performance
CREATE INDEX idx_capture_sessions_player ON public.capture_sessions(player_id);
CREATE INDEX idx_capture_sessions_user ON public.capture_sessions(user_id);
CREATE INDEX idx_capture_sessions_status ON public.capture_sessions(status);
CREATE INDEX idx_captured_swings_session ON public.captured_swings(session_id);
CREATE INDEX idx_captured_swings_player ON public.captured_swings(player_id);

-- Trigger for updated_at
CREATE TRIGGER update_capture_sessions_updated_at
  BEFORE UPDATE ON public.capture_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();