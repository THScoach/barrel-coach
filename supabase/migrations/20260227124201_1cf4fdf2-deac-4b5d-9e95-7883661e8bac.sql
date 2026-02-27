ALTER TABLE public.video_2d_sessions
  ADD COLUMN IF NOT EXISTS transfer_ratio numeric,
  ADD COLUMN IF NOT EXISTS ke_shape text,
  ADD COLUMN IF NOT EXISTS braking_quality text,
  ADD COLUMN IF NOT EXISTS trunk_tilt_std numeric,
  ADD COLUMN IF NOT EXISTS x_factor_peak numeric,
  ADD COLUMN IF NOT EXISTS com_barrel_dist numeric;