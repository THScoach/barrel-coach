-- Add momentum_overlays JSONB column to video_swing_sessions for storing KRS leak overlay data
ALTER TABLE public.video_swing_sessions 
ADD COLUMN IF NOT EXISTS momentum_overlays JSONB DEFAULT NULL;

-- Add comment explaining the structure
COMMENT ON COLUMN public.video_swing_sessions.momentum_overlays IS 'Stores momentum leak overlay data for video visualization. Structure: { leak_type, caption, frames: [{ time, regions: [{ segment, style }] }] }';