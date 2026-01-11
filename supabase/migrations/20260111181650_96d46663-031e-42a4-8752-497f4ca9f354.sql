-- Add is_in_season flag to players table
ALTER TABLE public.players 
ADD COLUMN IF NOT EXISTS is_in_season boolean DEFAULT false;

-- Create game_weekly_reports table for Coach Rick check-ins
CREATE TABLE public.game_weekly_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  week_end date NOT NULL,
  games integer,
  pa integer,
  ab integer,
  hits integer,
  doubles integer DEFAULT 0,
  triples integer DEFAULT 0,
  home_runs integer DEFAULT 0,
  xbh integer GENERATED ALWAYS AS (COALESCE(doubles, 0) + COALESCE(triples, 0) + COALESCE(home_runs, 0)) STORED,
  bb integer,
  k integer,
  best_moment text,
  biggest_struggle text,
  training_tags text[] DEFAULT '{}',
  body_fatigue integer CHECK (body_fatigue >= 0 AND body_fatigue <= 10),
  next_week_goal text,
  chat_transcript jsonb DEFAULT '[]',
  coach_summary text,
  trend_label text CHECK (trend_label IN ('up', 'flat', 'down')),
  source text DEFAULT 'chat_checkin',
  status text DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'skipped')),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone
);

-- Enable RLS
ALTER TABLE public.game_weekly_reports ENABLE ROW LEVEL SECURITY;

-- Indexes for performance
CREATE INDEX idx_game_weekly_reports_player_week ON public.game_weekly_reports(player_id, week_start DESC);
CREATE INDEX idx_game_weekly_reports_status ON public.game_weekly_reports(status);

-- RLS policies
-- Players can view their own reports
CREATE POLICY "Players can view own reports"
  ON public.game_weekly_reports
  FOR SELECT
  USING (
    player_id IN (
      SELECT id FROM public.players WHERE email = auth.jwt()->>'email'
    )
  );

-- Players can update their own in-progress reports
CREATE POLICY "Players can update own in-progress reports"
  ON public.game_weekly_reports
  FOR UPDATE
  USING (
    status = 'in_progress' AND
    player_id IN (
      SELECT id FROM public.players WHERE email = auth.jwt()->>'email'
    )
  );

-- Admins have full access
CREATE POLICY "Admins have full access to reports"
  ON public.game_weekly_reports
  FOR ALL
  USING (public.is_admin());

-- Service role can insert (for edge functions)
CREATE POLICY "Service can insert reports"
  ON public.game_weekly_reports
  FOR INSERT
  WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_game_weekly_reports_updated_at
  BEFORE UPDATE ON public.game_weekly_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_weekly_reports;