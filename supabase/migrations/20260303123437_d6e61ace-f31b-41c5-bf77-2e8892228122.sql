
ALTER TABLE public.swing_analysis
  ADD COLUMN IF NOT EXISTS ssi_bandwidth numeric,
  ADD COLUMN IF NOT EXISTS inter_sag_iqr numeric,
  ADD COLUMN IF NOT EXISTS inter_front_iqr numeric;

COMMENT ON COLUMN public.swing_analysis.ssi_bandwidth IS 'IQR of per-swing SSI values (inter-swing repeatability)';
COMMENT ON COLUMN public.swing_analysis.inter_sag_iqr IS 'IQR of per-swing sagittal SD across detected swings';
COMMENT ON COLUMN public.swing_analysis.inter_front_iqr IS 'IQR of per-swing frontal SD across detected swings';
