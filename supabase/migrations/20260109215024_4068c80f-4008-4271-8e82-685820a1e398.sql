-- Create drill_videos table
CREATE TABLE public.drill_videos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  transcript TEXT,
  transcript_segments JSONB,
  
  -- Categorization
  four_b_category TEXT CHECK (four_b_category IN ('brain', 'body', 'bat', 'ball')),
  drill_name TEXT,
  problems_addressed TEXT[],
  motor_profiles TEXT[],
  tags TEXT[],
  
  -- Access control
  access_level TEXT DEFAULT 'paid' CHECK (access_level IN ('free', 'paid', 'inner_circle')),
  
  -- Metadata
  duration_seconds INTEGER,
  video_type TEXT DEFAULT 'drill' CHECK (video_type IN ('drill', 'lesson', 'breakdown', 'q_and_a', 'live_session')),
  player_level TEXT[],
  
  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'published', 'archived')),
  published_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable full-text search on title, description, and transcript
CREATE INDEX drill_videos_search_idx ON public.drill_videos 
USING GIN (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(transcript, '')));

-- Index for filtering
CREATE INDEX drill_videos_category_idx ON public.drill_videos(four_b_category);
CREATE INDEX drill_videos_access_idx ON public.drill_videos(access_level);
CREATE INDEX drill_videos_status_idx ON public.drill_videos(status);

-- Create video_views table for analytics
CREATE TABLE public.video_views (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id UUID REFERENCES public.drill_videos(id) ON DELETE CASCADE,
  user_id UUID,
  session_id UUID,
  watched_seconds INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX video_views_video_idx ON public.video_views(video_id);
CREATE INDEX video_views_user_idx ON public.video_views(user_id);

-- Create updated_at trigger for drill_videos
CREATE TRIGGER update_drill_videos_updated_at
  BEFORE UPDATE ON public.drill_videos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Enable RLS
ALTER TABLE public.drill_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_views ENABLE ROW LEVEL SECURITY;

-- RLS policies for drill_videos
CREATE POLICY "Published videos viewable by everyone"
  ON public.drill_videos
  FOR SELECT
  USING (status = 'published');

CREATE POLICY "All videos viewable by service role"
  ON public.drill_videos
  FOR SELECT
  USING (auth.role() = 'service_role');

CREATE POLICY "Videos insertable by service role"
  ON public.drill_videos
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Videos updatable by service role"
  ON public.drill_videos
  FOR UPDATE
  USING (auth.role() = 'service_role');

CREATE POLICY "Videos deletable by service role"
  ON public.drill_videos
  FOR DELETE
  USING (auth.role() = 'service_role');

-- RLS policies for video_views
CREATE POLICY "Views insertable by anyone"
  ON public.video_views
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Views viewable by service role"
  ON public.video_views
  FOR SELECT
  USING (auth.role() = 'service_role');

-- Create search function
CREATE OR REPLACE FUNCTION public.search_videos(
  search_query TEXT, 
  category_filter TEXT DEFAULT NULL,
  level_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  video_url TEXT,
  thumbnail_url TEXT,
  transcript TEXT,
  four_b_category TEXT,
  drill_name TEXT,
  problems_addressed TEXT[],
  motor_profiles TEXT[],
  player_level TEXT[],
  duration_seconds INTEGER,
  access_level TEXT,
  video_type TEXT,
  tags TEXT[],
  rank REAL,
  headline TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    v.id,
    v.title,
    v.description,
    v.video_url,
    v.thumbnail_url,
    v.transcript,
    v.four_b_category,
    v.drill_name,
    v.problems_addressed,
    v.motor_profiles,
    v.player_level,
    v.duration_seconds,
    v.access_level,
    v.video_type,
    v.tags,
    ts_rank(
      to_tsvector('english', coalesce(v.title, '') || ' ' || coalesce(v.description, '') || ' ' || coalesce(v.transcript, '')),
      plainto_tsquery('english', search_query)
    )::REAL AS rank,
    ts_headline(
      'english',
      coalesce(v.transcript, v.description, ''),
      plainto_tsquery('english', search_query),
      'MaxWords=30, MinWords=15, StartSel=<mark>, StopSel=</mark>'
    ) AS headline
  FROM drill_videos v
  WHERE 
    v.status = 'published'
    AND (category_filter IS NULL OR v.four_b_category = category_filter)
    AND (level_filter IS NULL OR level_filter = ANY(v.player_level))
    AND (
      search_query = '' OR
      to_tsvector('english', coalesce(v.title, '') || ' ' || coalesce(v.description, '') || ' ' || coalesce(v.transcript, ''))
      @@ plainto_tsquery('english', search_query)
    )
  ORDER BY rank DESC
  LIMIT 50;
END;
$$;

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('videos', 'videos', false, 524288000, ARRAY['video/mp4', 'video/quicktime', 'video/webm']),
  ('video-thumbnails', 'video-thumbnails', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp']);

-- Storage policies for videos bucket
CREATE POLICY "Videos uploadable by service role"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'videos' AND auth.role() = 'service_role');

CREATE POLICY "Videos readable by service role"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'videos' AND auth.role() = 'service_role');

CREATE POLICY "Videos deletable by service role"
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'videos' AND auth.role() = 'service_role');

-- Storage policies for video-thumbnails bucket (public read)
CREATE POLICY "Thumbnails publicly readable"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'video-thumbnails');

CREATE POLICY "Thumbnails uploadable by service role"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'video-thumbnails' AND auth.role() = 'service_role');