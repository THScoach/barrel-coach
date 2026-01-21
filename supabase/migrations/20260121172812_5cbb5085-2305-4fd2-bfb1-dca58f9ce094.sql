-- Add file_hash column to drill_videos for deduplication
ALTER TABLE public.drill_videos ADD COLUMN IF NOT EXISTS file_hash text;

-- Add storage_path column to drill_videos for internal hosting
ALTER TABLE public.drill_videos ADD COLUMN IF NOT EXISTS storage_path text;

-- Create unique index on file_hash to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_drill_videos_file_hash 
ON public.drill_videos(file_hash) 
WHERE file_hash IS NOT NULL;

-- Function to check for duplicate academy video
CREATE OR REPLACE FUNCTION public.check_academy_video_duplicate(p_file_hash text)
RETURNS TABLE(id uuid, title text, video_url text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT dv.id, dv.title, dv.video_url
  FROM drill_videos dv
  WHERE dv.file_hash = p_file_hash
  LIMIT 1;
END;
$$;

-- Create player_video_prescriptions table for tracking prescribed videos
CREATE TABLE IF NOT EXISTS public.player_video_prescriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  video_id uuid NOT NULL REFERENCES public.drill_videos(id) ON DELETE CASCADE,
  prescribed_reason text,
  four_b_category text,
  session_id uuid,
  watched_at timestamp with time zone,
  watch_progress_pct integer DEFAULT 0,
  is_completed boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(player_id, video_id)
);

-- Enable RLS
ALTER TABLE public.player_video_prescriptions ENABLE ROW LEVEL SECURITY;

-- RLS policies for player_video_prescriptions
CREATE POLICY "Players can view their prescriptions"
ON public.player_video_prescriptions FOR SELECT
USING (
  player_id IN (
    SELECT id FROM players WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
);

CREATE POLICY "Players can update their prescriptions"
ON public.player_video_prescriptions FOR UPDATE
USING (
  player_id IN (
    SELECT id FROM players WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
);

CREATE POLICY "Admins manage all prescriptions"
ON public.player_video_prescriptions FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.email IN (
      'rick@catchingbarrels.com', 
      'admin@catchingbarrels.com',
      'coach@catchingbarrels.com'
    )
  )
);

-- Function to auto-prescribe videos based on 4B scores
CREATE OR REPLACE FUNCTION public.prescribe_videos_for_player(
  p_player_id uuid,
  p_weakest_category text,
  p_session_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  videos_prescribed integer := 0;
BEGIN
  INSERT INTO player_video_prescriptions (player_id, video_id, prescribed_reason, four_b_category, session_id)
  SELECT 
    p_player_id,
    dv.id,
    'Recommended to improve your ' || p_weakest_category || ' score',
    p_weakest_category,
    p_session_id
  FROM drill_videos dv
  WHERE 
    dv.status = 'published'
    AND lower(dv.four_b_category) = lower(p_weakest_category)
  ORDER BY dv.created_at DESC
  LIMIT 3
  ON CONFLICT (player_id, video_id) DO NOTHING;
  
  GET DIAGNOSTICS videos_prescribed = ROW_COUNT;
  RETURN videos_prescribed;
END;
$$;