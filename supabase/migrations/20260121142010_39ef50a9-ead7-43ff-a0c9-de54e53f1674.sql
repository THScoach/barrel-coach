-- Session Validation Engine: Add correlation and accuracy tracking fields

-- Add validation correlation fields to video_swing_sessions
ALTER TABLE public.video_swing_sessions
ADD COLUMN IF NOT EXISTS validation_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS correlated_reboot_id UUID REFERENCES public.reboot_uploads(id),
ADD COLUMN IF NOT EXISTS reboot_composite_delta NUMERIC,
ADD COLUMN IF NOT EXISTS accuracy_tier TEXT,
ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS validated_by TEXT;

-- Add correlation fields to reboot_uploads  
ALTER TABLE public.reboot_uploads
ADD COLUMN IF NOT EXISTS correlated_video_session_id UUID REFERENCES public.video_swing_sessions(id),
ADD COLUMN IF NOT EXISTS video_composite_delta NUMERIC,
ADD COLUMN IF NOT EXISTS validation_status TEXT DEFAULT 'pending';

-- Create index for fast correlation lookups by date and player
CREATE INDEX IF NOT EXISTS idx_video_swing_sessions_correlation 
ON public.video_swing_sessions(player_id, session_date, validation_status);

CREATE INDEX IF NOT EXISTS idx_reboot_uploads_correlation 
ON public.reboot_uploads(player_id, session_date, validation_status);

-- Create a view for unified sessions (combining 2D and 3D data)
CREATE OR REPLACE VIEW public.unified_sessions AS
SELECT 
  vss.id,
  vss.player_id,
  vss.session_date,
  '2d_video' as source_type,
  vss.composite_score,
  vss.brain_score,
  vss.body_score,
  vss.bat_score,
  vss.ball_score,
  vss.primary_leak,
  vss.weakest_link,
  vss.analyzed_count as swing_count,
  vss.is_active,
  vss.ended_at,
  vss.validation_status,
  vss.correlated_reboot_id,
  vss.reboot_composite_delta,
  vss.accuracy_tier,
  vss.created_at,
  vss.updated_at
FROM public.video_swing_sessions vss
WHERE vss.is_active = false AND vss.composite_score IS NOT NULL

UNION ALL

SELECT
  ru.id,
  ru.player_id,
  ru.session_date,
  '3d_reboot' as source_type,
  ru.composite_score,
  ru.brain_score,
  ru.body_score,
  ru.bat_score,
  NULL as ball_score, -- reboot_uploads may not have ball_score
  ru.leak_detected as primary_leak,
  ru.weakest_link,
  1 as swing_count, -- Reboot uploads are single-swing
  false as is_active,
  ru.completed_at as ended_at,
  ru.validation_status,
  ru.correlated_video_session_id as correlated_reboot_id,
  ru.video_composite_delta as reboot_composite_delta,
  CASE 
    WHEN ABS(COALESCE(ru.video_composite_delta, 999)) < 5 THEN 'high'
    WHEN ABS(COALESCE(ru.video_composite_delta, 999)) < 10 THEN 'medium'
    ELSE 'low'
  END as accuracy_tier,
  ru.created_at,
  ru.updated_at
FROM public.reboot_uploads ru
WHERE ru.processing_status = 'complete' AND ru.composite_score IS NOT NULL;

COMMENT ON VIEW public.unified_sessions IS 'Unified view of 2D video and 3D Reboot sessions for correlation analysis';