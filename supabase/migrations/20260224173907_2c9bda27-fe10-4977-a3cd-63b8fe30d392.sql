ALTER TABLE public.video_2d_sessions
  ADD COLUMN IF NOT EXISTS axis_stability_type text,
  ADD COLUMN IF NOT EXISTS axis_stability_score integer,
  ADD COLUMN IF NOT EXISTS cog_velo_y numeric,
  ADD COLUMN IF NOT EXISTS pelvis_av numeric,
  ADD COLUMN IF NOT EXISTS trunk_av numeric,
  ADD COLUMN IF NOT EXISTS arm_av numeric,
  ADD COLUMN IF NOT EXISTS pt_ratio numeric,
  ADD COLUMN IF NOT EXISTS ta_ratio numeric,
  ADD COLUMN IF NOT EXISTS stability_note text,
  ADD COLUMN IF NOT EXISTS stability_cue text;