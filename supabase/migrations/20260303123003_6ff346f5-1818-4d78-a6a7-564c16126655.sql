
ALTER TABLE public.swing_analysis
  ADD COLUMN IF NOT EXISTS trunk_lat_mean numeric,
  ADD COLUMN IF NOT EXISTS trunk_ssi numeric,
  ADD COLUMN IF NOT EXISTS dump_direction text;

COMMENT ON COLUMN public.swing_analysis.trunk_lat_mean IS 'Mean torso lateral tilt (degrees) within stride-to-contact window';
COMMENT ON COLUMN public.swing_analysis.trunk_ssi IS 'Swing Stability Index (0-100, 100=rock solid)';
COMMENT ON COLUMN public.swing_analysis.dump_direction IS 'Lateral dump classification: neutral, glove_side, pull_side';
