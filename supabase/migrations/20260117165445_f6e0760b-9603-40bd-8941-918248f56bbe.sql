-- Create batch sessions table to group individual swing analyses
CREATE TABLE public.video_2d_batch_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID REFERENCES public.players(id),
  session_name TEXT,
  session_type VARCHAR(50),
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  frame_rate INTEGER,
  swing_count INTEGER DEFAULT 0,
  completed_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  avg_composite NUMERIC,
  avg_body INTEGER,
  avg_brain INTEGER,
  avg_bat INTEGER,
  avg_ball INTEGER,
  most_common_leak VARCHAR(100),
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add batch_session_id to link individual swings to a batch session
ALTER TABLE public.video_2d_sessions 
ADD COLUMN batch_session_id UUID REFERENCES public.video_2d_batch_sessions(id);

-- Add swing_index to track order within batch
ALTER TABLE public.video_2d_sessions 
ADD COLUMN swing_index INTEGER;

-- Enable RLS
ALTER TABLE public.video_2d_batch_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies (admin-only for now)
CREATE POLICY "Allow all access for authenticated users" 
ON public.video_2d_batch_sessions
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_video_2d_sessions_batch ON public.video_2d_sessions(batch_session_id);
CREATE INDEX idx_video_2d_batch_sessions_player ON public.video_2d_batch_sessions(player_id);

-- Trigger to update updated_at
CREATE TRIGGER update_video_2d_batch_sessions_updated_at
BEFORE UPDATE ON public.video_2d_batch_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();