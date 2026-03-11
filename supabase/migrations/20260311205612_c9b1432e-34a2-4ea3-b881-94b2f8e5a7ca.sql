ALTER TABLE public.reboot_sessions 
ADD COLUMN session_type text NOT NULL DEFAULT 'bp' 
  CHECK (session_type IN ('bp', 'drill', 'game', 'tee', 'live_pitching')),
ADD COLUMN drill_name text;