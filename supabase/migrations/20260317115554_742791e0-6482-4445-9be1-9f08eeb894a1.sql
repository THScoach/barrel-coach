
-- New interpretation layer table: one row per scored session
CREATE TABLE public.hitting_4b_krs_sessions (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id                   uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  player_session_id           uuid NOT NULL REFERENCES public.player_sessions(id) ON DELETE CASCADE,
  reboot_session_id           text,
  session_date                timestamptz NOT NULL,
  formula_version             text DEFAULT '4B-KRS-v1',

  body_score                  numeric,
  bat_score                   numeric,
  brain_score                 numeric,
  ball_score                  numeric,
  krs_score                   numeric,

  has_sequence_issue          boolean DEFAULT false,
  has_momentum_issue          boolean DEFAULT false,
  has_plane_issue             boolean DEFAULT false,
  has_range_usage_issue       boolean DEFAULT false,
  has_balance_stability_issue boolean DEFAULT false,
  main_constraint             text,
  secondary_constraint        text,
  weakest_b                   text,

  summary_coach_text          text,
  summary_player_text         text,
  focus_next_bp               text,
  recommended_drills          jsonb,
  recommended_cues            jsonb,

  formula_inputs              jsonb,

  created_at                  timestamptz DEFAULT now(),
  updated_at                  timestamptz DEFAULT now()
);

CREATE INDEX idx_h4bkrs_player_id ON public.hitting_4b_krs_sessions (player_id);
CREATE INDEX idx_h4bkrs_player_session_id ON public.hitting_4b_krs_sessions (player_session_id);
CREATE INDEX idx_h4bkrs_reboot_session_id ON public.hitting_4b_krs_sessions (reboot_session_id);
CREATE INDEX idx_h4bkrs_session_date ON public.hitting_4b_krs_sessions (player_id, session_date DESC);

ALTER TABLE public.hitting_4b_krs_sessions ENABLE ROW LEVEL SECURITY;

-- Admins full access
CREATE POLICY "Admins full access on hitting_4b_krs_sessions"
  ON public.hitting_4b_krs_sessions
  FOR ALL
  TO authenticated
  USING (public.is_admin());

-- Players read own rows (matching existing pattern: players.email = auth.users.email)
CREATE POLICY "Players can view own hitting_4b_krs_sessions"
  ON public.hitting_4b_krs_sessions
  FOR SELECT
  TO authenticated
  USING (
    player_id IN (
      SELECT p.id FROM public.players p
      WHERE p.email = (SELECT u.email FROM auth.users u WHERE u.id = auth.uid())::text
    )
    OR public.is_admin()
  );

-- Service role insert/update (for edge functions)
CREATE POLICY "Service role full access on hitting_4b_krs_sessions"
  ON public.hitting_4b_krs_sessions
  FOR ALL
  USING (auth.role() = 'service_role');

-- updated_at trigger
CREATE TRIGGER update_hitting_4b_krs_sessions_updated_at
  BEFORE UPDATE ON public.hitting_4b_krs_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
