-- Create video_playlists table for manual playlists
CREATE TABLE public.video_playlists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  playlist_type TEXT NOT NULL DEFAULT 'manual' CHECK (playlist_type IN ('manual', 'smart')),
  smart_filter JSONB, -- For smart playlists: { "four_b_category": "brain", "problems": ["casting"] }
  cover_image_url TEXT,
  is_published BOOLEAN DEFAULT false,
  video_count INTEGER DEFAULT 0,
  total_duration_seconds INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create playlist_videos junction table
CREATE TABLE public.playlist_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  playlist_id UUID NOT NULL REFERENCES public.video_playlists(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES public.drill_videos(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(playlist_id, video_id)
);

-- Enable RLS
ALTER TABLE public.video_playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_videos ENABLE ROW LEVEL SECURITY;

-- RLS policies for video_playlists
CREATE POLICY "Admins can manage video playlists"
ON public.video_playlists FOR ALL
USING (public.is_admin());

CREATE POLICY "Published playlists are viewable by all authenticated users"
ON public.video_playlists FOR SELECT
USING (is_published = true AND auth.uid() IS NOT NULL);

-- RLS policies for playlist_videos
CREATE POLICY "Admins can manage playlist videos"
ON public.playlist_videos FOR ALL
USING (public.is_admin());

CREATE POLICY "Users can view videos in published playlists"
ON public.playlist_videos FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.video_playlists vp
    WHERE vp.id = playlist_id
    AND (vp.is_published = true OR public.is_admin())
  )
);

-- Indexes for performance
CREATE INDEX idx_video_playlists_type ON public.video_playlists(playlist_type);
CREATE INDEX idx_video_playlists_published ON public.video_playlists(is_published);
CREATE INDEX idx_playlist_videos_playlist ON public.playlist_videos(playlist_id);
CREATE INDEX idx_playlist_videos_video ON public.playlist_videos(video_id);
CREATE INDEX idx_playlist_videos_position ON public.playlist_videos(playlist_id, position);

-- Full-text search index on drill_videos for transcript search
CREATE INDEX IF NOT EXISTS idx_drill_videos_transcript_search 
ON public.drill_videos USING gin(to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(transcript, '')));

-- Update video_count and total_duration when videos are added/removed
CREATE OR REPLACE FUNCTION public.update_playlist_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE public.video_playlists
    SET 
      video_count = (SELECT COUNT(*) FROM public.playlist_videos WHERE playlist_id = NEW.playlist_id),
      total_duration_seconds = (
        SELECT COALESCE(SUM(dv.duration_seconds), 0)
        FROM public.playlist_videos pv
        JOIN public.drill_videos dv ON dv.id = pv.video_id
        WHERE pv.playlist_id = NEW.playlist_id
      ),
      updated_at = now()
    WHERE id = NEW.playlist_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.video_playlists
    SET 
      video_count = (SELECT COUNT(*) FROM public.playlist_videos WHERE playlist_id = OLD.playlist_id),
      total_duration_seconds = (
        SELECT COALESCE(SUM(dv.duration_seconds), 0)
        FROM public.playlist_videos pv
        JOIN public.drill_videos dv ON dv.id = pv.video_id
        WHERE pv.playlist_id = OLD.playlist_id
      ),
      updated_at = now()
    WHERE id = OLD.playlist_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_playlist_stats_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.playlist_videos
FOR EACH ROW EXECUTE FUNCTION public.update_playlist_stats();

-- Create enhanced search function for concept search
CREATE OR REPLACE FUNCTION public.search_videos_by_concept(
  search_query TEXT,
  category_filter TEXT DEFAULT NULL,
  max_results INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  video_url TEXT,
  thumbnail_url TEXT,
  transcript TEXT,
  four_b_category TEXT,
  problems_addressed TEXT[],
  duration_seconds INTEGER,
  status TEXT,
  gumlet_playback_url TEXT,
  gumlet_hls_url TEXT,
  relevance_score REAL,
  matched_excerpt TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dv.id,
    dv.title,
    dv.description,
    dv.video_url,
    dv.thumbnail_url,
    dv.transcript,
    dv.four_b_category,
    dv.problems_addressed,
    dv.duration_seconds,
    dv.status,
    dv.gumlet_playback_url,
    dv.gumlet_hls_url,
    ts_rank(
      to_tsvector('english', COALESCE(dv.title, '') || ' ' || COALESCE(dv.transcript, '')),
      plainto_tsquery('english', search_query)
    ) AS relevance_score,
    ts_headline(
      'english',
      COALESCE(dv.transcript, dv.title),
      plainto_tsquery('english', search_query),
      'MaxWords=30, MinWords=15, StartSel=<mark>, StopSel=</mark>'
    ) AS matched_excerpt
  FROM public.drill_videos dv
  WHERE 
    dv.status = 'published'
    AND (category_filter IS NULL OR dv.four_b_category = category_filter)
    AND to_tsvector('english', COALESCE(dv.title, '') || ' ' || COALESCE(dv.transcript, '')) 
        @@ plainto_tsquery('english', search_query)
  ORDER BY relevance_score DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to update updated_at
CREATE TRIGGER update_video_playlists_updated_at
BEFORE UPDATE ON public.video_playlists
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();