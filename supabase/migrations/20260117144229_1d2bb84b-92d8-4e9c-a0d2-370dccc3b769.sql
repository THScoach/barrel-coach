-- Add missing swing_count column to video_swing_sessions
ALTER TABLE public.video_swing_sessions 
ADD COLUMN IF NOT EXISTS swing_count integer DEFAULT 0;