
-- Add session_type and recording_date columns to player_kommodo_recordings
ALTER TABLE public.player_kommodo_recordings ADD COLUMN IF NOT EXISTS session_type TEXT;
ALTER TABLE public.player_kommodo_recordings ADD COLUMN IF NOT EXISTS recording_date DATE;
