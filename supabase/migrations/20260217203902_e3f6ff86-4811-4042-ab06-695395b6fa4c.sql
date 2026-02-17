
-- Table: swing_sessions (2D Gemini analyzer sessions)
CREATE TABLE IF NOT EXISTS public.swing_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid REFERENCES public.players(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  video_url text,
  analysis_status text NOT NULL DEFAULT 'pending',
  analysis_source text NOT NULL DEFAULT '2d_gemini',
  motor_profile_hint text DEFAULT 'unknown',
  body_score integer,
  brain_score integer,
  bat_score integer,
  ball_score integer,
  composite_score integer,
  leaks_detected jsonb DEFAULT '[]'::jsonb,
  speed_gains jsonb,
  energy_pattern text DEFAULT 'unknown',
  contact_window_type text DEFAULT 'unknown',
  coaching_priority text,
  raw_gemini_response jsonb,
  gemini_confidence integer
);

-- Table: swing_leaks
CREATE TABLE IF NOT EXISTS public.swing_leaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.swing_sessions(id) ON DELETE CASCADE,
  leak_name text NOT NULL,
  severity text NOT NULL DEFAULT 'moderate',
  description text,
  frame_reference text
);

-- RLS
ALTER TABLE public.swing_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swing_leaks ENABLE ROW LEVEL SECURITY;

-- Admins full access
CREATE POLICY "Admins full access to swing_sessions"
  ON public.swing_sessions FOR ALL
  USING (public.is_admin());

CREATE POLICY "Admins full access to swing_leaks"
  ON public.swing_leaks FOR ALL
  USING (public.is_admin());

-- Public read for swing_sessions (players view their own)
CREATE POLICY "Players view own swing_sessions"
  ON public.swing_sessions FOR SELECT
  USING (true);

-- Public read for swing_leaks via session
CREATE POLICY "Anyone can read swing_leaks"
  ON public.swing_leaks FOR SELECT
  USING (true);
