
-- Add external_session_id to sensor_sessions for global session matching
ALTER TABLE public.sensor_sessions ADD COLUMN IF NOT EXISTS external_session_id TEXT UNIQUE;

-- Add new swing metric columns to sensor_swings
ALTER TABLE public.sensor_swings ADD COLUMN IF NOT EXISTS on_plane_pct NUMERIC;
ALTER TABLE public.sensor_swings ADD COLUMN IF NOT EXISTS hand_cast NUMERIC;
ALTER TABLE public.sensor_swings ADD COLUMN IF NOT EXISTS vertical_bat_angle NUMERIC;
ALTER TABLE public.sensor_swings ADD COLUMN IF NOT EXISTS swing_plane_steepness NUMERIC;

-- Create dk_sync_log table for tracking sync runs
CREATE TABLE IF NOT EXISTS public.dk_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',
  sessions_found INT DEFAULT 0,
  sessions_added INT DEFAULT 0,
  swings_added INT DEFAULT 0,
  players_matched INT DEFAULT 0,
  error TEXT,
  triggered_by TEXT DEFAULT 'cron',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: only service_role can access dk_sync_log
ALTER TABLE public.dk_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on dk_sync_log" ON public.dk_sync_log FOR ALL TO service_role USING (true) WITH CHECK (true);
