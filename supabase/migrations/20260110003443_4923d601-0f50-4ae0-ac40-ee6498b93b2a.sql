-- Add problems_identified column to sessions table
ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS problems_identified TEXT[] DEFAULT '{}';

-- Create the get_recommended_videos function
CREATE OR REPLACE FUNCTION public.get_recommended_videos(
  p_session_id UUID,
  p_limit INTEGER DEFAULT 6
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  video_url TEXT,
  thumbnail_url TEXT,
  four_b_category TEXT,
  problems_addressed TEXT[],
  duration_seconds INTEGER,
  access_level TEXT,
  relevance_score INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_weakest_category TEXT;
  v_problems TEXT[];
  v_player_level TEXT;
BEGIN
  -- Get player's weakest category, problems, and level
  SELECT 
    s.weakest_category,
    COALESCE(s.problems_identified, '{}'),
    s.player_level
  INTO v_weakest_category, v_problems, v_player_level
  FROM sessions s
  WHERE s.id = p_session_id;

  RETURN QUERY
  SELECT 
    dv.id,
    dv.title,
    dv.description,
    dv.video_url,
    dv.thumbnail_url,
    dv.four_b_category,
    dv.problems_addressed,
    dv.duration_seconds,
    dv.access_level,
    -- Calculate relevance score
    (
      CASE WHEN dv.four_b_category = v_weakest_category THEN 50 ELSE 0 END +
      CASE WHEN dv.problems_addressed && v_problems THEN 30 ELSE 0 END +
      CASE WHEN v_player_level = ANY(dv.player_level) THEN 20 ELSE 0 END
    )::INTEGER AS relevance_score
  FROM drill_videos dv
  WHERE 
    dv.status = 'published'
    AND (
      dv.four_b_category = v_weakest_category
      OR dv.problems_addressed && v_problems
      OR v_player_level = ANY(dv.player_level)
    )
  ORDER BY relevance_score DESC, dv.created_at DESC
  LIMIT p_limit;
END;
$$;