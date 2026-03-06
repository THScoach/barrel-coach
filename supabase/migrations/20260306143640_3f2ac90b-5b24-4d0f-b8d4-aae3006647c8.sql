
-- Table 1: reboot_swing_sessions (named to avoid conflict with existing swing_sessions)
CREATE TABLE public.reboot_swing_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid REFERENCES public.players(id) ON DELETE CASCADE NOT NULL,
  session_date date NOT NULL,
  swing_count integer,
  com_drift_inches real,
  com_velocity_mps real,
  drift_variability_inches real,
  pelvis_peak_deg_s real,
  pelvis_angular_momentum real,
  trunk_peak_deg_s real,
  trunk_variability_cv real,
  trunk_frontal_change_deg real,
  trunk_lateral_change_deg real,
  pelvis_torso_gap_ms real,
  pelvis_torso_gain real,
  torso_arm_gain real,
  arm_bat_gain real,
  arm_variability_cv real,
  exit_velocity_max real,
  exit_velocity_min real,
  height_inches real,
  weight_lbs real,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Table 2: swing_scores
CREATE TABLE public.swing_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.reboot_swing_sessions(id) ON DELETE CASCADE NOT NULL,
  platform_score integer DEFAULT 0,
  swing_window_score integer DEFAULT 0,
  window_timing_score integer DEFAULT 0,
  window_space_score integer DEFAULT 0,
  body_score integer DEFAULT 0,
  brain_score integer DEFAULT 0,
  bat_score integer DEFAULT 0,
  ball_score integer DEFAULT 0,
  swing_archetype text,
  root_issue text,
  ev_floor real,
  ev_gap real,
  report_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_reboot_swing_sessions_player_date ON public.reboot_swing_sessions(player_id, session_date);
CREATE INDEX idx_swing_scores_session ON public.swing_scores(session_id);

-- RLS
ALTER TABLE public.reboot_swing_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swing_scores ENABLE ROW LEVEL SECURITY;

-- reboot_swing_sessions policies
CREATE POLICY "Authenticated users can read reboot_swing_sessions"
  ON public.reboot_swing_sessions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own reboot_swing_sessions"
  ON public.reboot_swing_sessions FOR INSERT TO authenticated
  WITH CHECK (
    player_id IN (
      SELECT p.id FROM public.players p WHERE p.email = (auth.jwt() ->> 'email')
    )
    OR public.is_admin()
  );

CREATE POLICY "Service role full access reboot_swing_sessions"
  ON public.reboot_swing_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- swing_scores policies
CREATE POLICY "Authenticated users can read swing_scores"
  ON public.swing_scores FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own swing_scores"
  ON public.swing_scores FOR INSERT TO authenticated
  WITH CHECK (
    session_id IN (
      SELECT ss.id FROM public.reboot_swing_sessions ss
      JOIN public.players p ON p.id = ss.player_id
      WHERE p.email = (auth.jwt() ->> 'email')
    )
    OR public.is_admin()
  );

CREATE POLICY "Service role full access swing_scores"
  ON public.swing_scores FOR ALL TO service_role USING (true) WITH CHECK (true);
