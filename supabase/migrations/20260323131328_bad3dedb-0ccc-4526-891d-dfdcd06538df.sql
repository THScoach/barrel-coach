ALTER TABLE public.player_sessions 
ADD COLUMN IF NOT EXISTS scoring_status text NOT NULL DEFAULT 'pending';