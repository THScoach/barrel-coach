
-- Add trunk stability columns to swing_analysis
ALTER TABLE public.swing_analysis
  ADD COLUMN IF NOT EXISTS trunk_pitch_sd numeric,
  ADD COLUMN IF NOT EXISTS trunk_lat_sd numeric,
  ADD COLUMN IF NOT EXISTS trunk_rot_cv numeric;
