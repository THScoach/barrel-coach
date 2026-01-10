-- Add validation study column to players table
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS is_validation_study BOOLEAN DEFAULT false;

-- Add index for filtering validation study players
CREATE INDEX IF NOT EXISTS idx_players_validation_study ON public.players(is_validation_study) WHERE is_validation_study = true;