-- Add columns for full 4B Bio Engine output
ALTER TABLE public.player_sessions 
  ADD COLUMN IF NOT EXISTS raw_metrics JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS projections JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS kinetic_potential JSONB DEFAULT '{}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.player_sessions.raw_metrics IS 'Raw biomechanical metrics (avg KE values, CV scores, etc.)';
COMMENT ON COLUMN public.player_sessions.projections IS 'Kinetic Potential projections (bat speed, exit velo estimates)';
COMMENT ON COLUMN public.player_sessions.kinetic_potential IS 'Mass-normalized Kinetic Potential Layer (bat speed ceiling, mph left on table)';