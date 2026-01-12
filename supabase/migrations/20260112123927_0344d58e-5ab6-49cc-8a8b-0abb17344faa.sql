-- Add GIN index for full-text search on transcripts
CREATE INDEX IF NOT EXISTS idx_drill_videos_transcript_fts 
ON drill_videos USING GIN (to_tsvector('english', COALESCE(transcript, '')));

-- Create function for transcript-based semantic search
CREATE OR REPLACE FUNCTION search_video_transcripts(
  search_query TEXT,
  category_filter TEXT DEFAULT NULL,
  max_results INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  transcript TEXT,
  four_b_category TEXT,
  problems_addressed TEXT[],
  duration_seconds INTEGER,
  video_url TEXT,
  thumbnail_url TEXT,
  relevance_score REAL,
  matching_excerpt TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dv.id,
    dv.title,
    dv.description,
    dv.transcript,
    dv.four_b_category,
    dv.problems_addressed,
    dv.duration_seconds,
    dv.video_url,
    dv.thumbnail_url,
    ts_rank_cd(
      setweight(to_tsvector('english', COALESCE(dv.title, '')), 'A') ||
      setweight(to_tsvector('english', COALESCE(dv.description, '')), 'B') ||
      setweight(to_tsvector('english', COALESCE(dv.transcript, '')), 'C'),
      plainto_tsquery('english', search_query)
    )::REAL AS relevance_score,
    ts_headline(
      'english',
      COALESCE(dv.transcript, dv.description, ''),
      plainto_tsquery('english', search_query),
      'MaxWords=40, MinWords=20, StartSel=**, StopSel=**'
    ) AS matching_excerpt
  FROM drill_videos dv
  WHERE 
    dv.status = 'published'
    AND dv.transcript IS NOT NULL
    AND (category_filter IS NULL OR dv.four_b_category = category_filter)
    AND (
      search_query = '' OR
      to_tsvector('english', 
        COALESCE(dv.title, '') || ' ' || 
        COALESCE(dv.description, '') || ' ' || 
        COALESCE(dv.transcript, '')
      ) @@ plainto_tsquery('english', search_query)
    )
  ORDER BY relevance_score DESC
  LIMIT max_results;
END;
$$;

-- Create function to find similar videos based on transcript content
CREATE OR REPLACE FUNCTION find_similar_videos(
  video_id_param UUID,
  max_results INTEGER DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  four_b_category TEXT,
  problems_addressed TEXT[],
  duration_seconds INTEGER,
  video_url TEXT,
  thumbnail_url TEXT,
  similarity_score REAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  source_transcript TEXT;
  source_category TEXT;
  source_problems TEXT[];
BEGIN
  -- Get the source video's content
  SELECT 
    dv.transcript,
    dv.four_b_category,
    dv.problems_addressed
  INTO source_transcript, source_category, source_problems
  FROM drill_videos dv
  WHERE dv.id = video_id_param;

  IF source_transcript IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    dv.id,
    dv.title,
    dv.description,
    dv.four_b_category,
    dv.problems_addressed,
    dv.duration_seconds,
    dv.video_url,
    dv.thumbnail_url,
    (
      -- Category match bonus
      CASE WHEN dv.four_b_category = source_category THEN 0.3 ELSE 0 END +
      -- Problem overlap bonus
      CASE WHEN dv.problems_addressed && source_problems THEN 0.3 ELSE 0 END +
      -- Transcript similarity (using trigram would be better but using basic search)
      ts_rank(
        to_tsvector('english', COALESCE(dv.transcript, '')),
        plainto_tsquery('english', LEFT(source_transcript, 500))
      ) * 0.4
    )::REAL AS similarity_score
  FROM drill_videos dv
  WHERE 
    dv.status = 'published'
    AND dv.id != video_id_param
    AND dv.transcript IS NOT NULL
  ORDER BY similarity_score DESC
  LIMIT max_results;
END;
$$;