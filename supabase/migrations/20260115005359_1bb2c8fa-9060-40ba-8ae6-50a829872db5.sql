-- Add free_diagnostic_report jsonb column to swing_analyses
ALTER TABLE public.swing_analyses 
ADD COLUMN IF NOT EXISTS free_diagnostic_report jsonb DEFAULT NULL;

-- Add player_id column if missing (for direct player association)
ALTER TABLE public.swing_analyses 
ADD COLUMN IF NOT EXISTS player_id uuid REFERENCES public.players(id) ON DELETE SET NULL;

-- Add video_url and video_name columns for OnForm imports
ALTER TABLE public.swing_analyses 
ADD COLUMN IF NOT EXISTS video_url text;

ALTER TABLE public.swing_analyses 
ADD COLUMN IF NOT EXISTS video_name text;

ALTER TABLE public.swing_analyses 
ADD COLUMN IF NOT EXISTS thumbnail_url text;

-- Add index for efficient session lookups
CREATE INDEX IF NOT EXISTS idx_swing_analyses_session_id ON public.swing_analyses(session_id);

-- Add index for player lookups
CREATE INDEX IF NOT EXISTS idx_swing_analyses_player_id ON public.swing_analyses(player_id);