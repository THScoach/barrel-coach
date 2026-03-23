
CREATE TABLE public.player_known_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID REFERENCES public.players(id) NOT NULL,
  metric_type TEXT NOT NULL,
  value NUMERIC NOT NULL,
  source TEXT NOT NULL,
  recorded_date DATE,
  percentile INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.player_known_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage known metrics"
  ON public.player_known_metrics
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Players can view own known metrics"
  ON public.player_known_metrics
  FOR SELECT
  TO authenticated
  USING (true);
