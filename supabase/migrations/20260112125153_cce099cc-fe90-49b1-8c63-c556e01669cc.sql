-- Add Gumlet-specific columns to drill_videos table
ALTER TABLE public.drill_videos 
ADD COLUMN IF NOT EXISTS gumlet_asset_id TEXT,
ADD COLUMN IF NOT EXISTS gumlet_playback_url TEXT,
ADD COLUMN IF NOT EXISTS gumlet_hls_url TEXT,
ADD COLUMN IF NOT EXISTS gumlet_dash_url TEXT;

-- Create index on gumlet_asset_id for webhook lookups
CREATE INDEX IF NOT EXISTS idx_drill_videos_gumlet_asset_id 
ON public.drill_videos(gumlet_asset_id) 
WHERE gumlet_asset_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.drill_videos.gumlet_asset_id IS 'Gumlet video asset ID for API operations';
COMMENT ON COLUMN public.drill_videos.gumlet_playback_url IS 'Gumlet MP4 playback URL';
COMMENT ON COLUMN public.drill_videos.gumlet_hls_url IS 'Gumlet HLS streaming URL for adaptive playback';
COMMENT ON COLUMN public.drill_videos.gumlet_dash_url IS 'Gumlet DASH streaming URL';