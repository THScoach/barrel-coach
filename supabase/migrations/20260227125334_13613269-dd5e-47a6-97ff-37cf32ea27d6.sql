
CREATE TABLE public.player_streaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid REFERENCES public.players(id) ON DELETE CASCADE NOT NULL UNIQUE,
  current_streak integer DEFAULT 0,
  longest_streak integer DEFAULT 0,
  last_activity_date date,
  streak_type text DEFAULT 'swing_upload',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.player_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access on player_streaks" ON public.player_streaks FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Service role full access on player_streaks" ON public.player_streaks FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Public read streaks" ON public.player_streaks FOR SELECT TO anon, authenticated USING (true);

CREATE TRIGGER trg_player_streaks_updated_at
  BEFORE UPDATE ON public.player_streaks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
