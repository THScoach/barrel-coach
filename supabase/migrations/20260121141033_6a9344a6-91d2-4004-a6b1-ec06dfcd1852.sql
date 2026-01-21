-- Add session state management columns to video_swing_sessions
ALTER TABLE public.video_swing_sessions 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS composite_score NUMERIC,
ADD COLUMN IF NOT EXISTS brain_score INTEGER,
ADD COLUMN IF NOT EXISTS body_score INTEGER,
ADD COLUMN IF NOT EXISTS bat_score INTEGER,
ADD COLUMN IF NOT EXISTS ball_score INTEGER,
ADD COLUMN IF NOT EXISTS primary_leak TEXT,
ADD COLUMN IF NOT EXISTS leak_frequency INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS weakest_link TEXT;

-- Add comment explaining the flow
COMMENT ON COLUMN public.video_swing_sessions.is_active IS 'True while session is open for uploads. False after player clicks End Session.';
COMMENT ON COLUMN public.video_swing_sessions.primary_leak IS 'Most frequent leak detected across all swings in this session.';
COMMENT ON COLUMN public.video_swing_sessions.weakest_link IS 'The 4B category (brain/body/bat/ball) needing most improvement, used for drill prescription.';

-- Create index for finding active sessions quickly
CREATE INDEX IF NOT EXISTS idx_video_swing_sessions_active ON public.video_swing_sessions(player_id, is_active) WHERE is_active = true;