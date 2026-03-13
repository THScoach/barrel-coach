
ALTER TABLE public.player_sessions
  ADD COLUMN IF NOT EXISTS bat_speed_source TEXT,
  ADD COLUMN IF NOT EXISTS bat_speed_confidence TEXT;

ALTER TABLE public.reboot_sessions
  ADD COLUMN IF NOT EXISTS measured_bat_speed_mph NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS measured_ev_mph NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS bat_speed_source TEXT,
  ADD COLUMN IF NOT EXISTS bat_speed_confidence TEXT;
