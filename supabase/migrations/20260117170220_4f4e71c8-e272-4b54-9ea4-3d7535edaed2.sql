-- Add missing aggregate columns to video_2d_batch_sessions
ALTER TABLE public.video_2d_batch_sessions
ADD COLUMN IF NOT EXISTS consistency_cv NUMERIC,
ADD COLUMN IF NOT EXISTS primary_leak TEXT,
ADD COLUMN IF NOT EXISTS leak_frequency TEXT,
ADD COLUMN IF NOT EXISTS motor_profile TEXT,
ADD COLUMN IF NOT EXISTS profile_confidence NUMERIC,
ADD COLUMN IF NOT EXISTS upgraded_to_3d BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reboot_session_id UUID,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS location TEXT;

-- Add swing_number and individual score columns to video_2d_sessions if missing
ALTER TABLE public.video_2d_sessions
ADD COLUMN IF NOT EXISTS swing_number INTEGER,
ADD COLUMN IF NOT EXISTS body_score NUMERIC,
ADD COLUMN IF NOT EXISTS brain_score NUMERIC,
ADD COLUMN IF NOT EXISTS bat_score NUMERIC,
ADD COLUMN IF NOT EXISTS ball_score NUMERIC,
ADD COLUMN IF NOT EXISTS leak_detected TEXT,
ADD COLUMN IF NOT EXISTS leak_evidence TEXT,
ADD COLUMN IF NOT EXISTS motor_profile_indication TEXT;

-- Create index for efficient session queries
CREATE INDEX IF NOT EXISTS idx_video_2d_batch_sessions_player_date 
ON public.video_2d_batch_sessions(player_id, session_date DESC);

CREATE INDEX IF NOT EXISTS idx_video_2d_sessions_batch_id 
ON public.video_2d_sessions(batch_session_id);

-- Add comment for clarity
COMMENT ON TABLE public.video_2d_batch_sessions IS 'Container for training sessions - holds aggregate metrics across multiple swings';
COMMENT ON TABLE public.video_2d_sessions IS 'Individual swings within a training session';