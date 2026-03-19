-- Add swing duration classification columns to player_sessions
ALTER TABLE public.player_sessions 
  ADD COLUMN IF NOT EXISTS swing_duration_ms numeric,
  ADD COLUMN IF NOT EXISTS swing_classification text DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS scoreable boolean DEFAULT true;

-- Add index for filtering by classification
CREATE INDEX IF NOT EXISTS idx_player_sessions_classification 
  ON public.player_sessions (swing_classification);

CREATE INDEX IF NOT EXISTS idx_player_sessions_scoreable 
  ON public.player_sessions (player_id, scoreable) 
  WHERE scoreable = true;

COMMENT ON COLUMN public.player_sessions.swing_duration_ms IS 'Swing duration in ms from first IK frame to max dom hand velo';
COMMENT ON COLUMN public.player_sessions.swing_classification IS 'competitive | load_overweight | walkthrough | partial_capture | unknown';
COMMENT ON COLUMN public.player_sessions.scoreable IS 'Whether this swing should be included in 4B session averages';