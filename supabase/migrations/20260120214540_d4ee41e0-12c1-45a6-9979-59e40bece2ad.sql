-- Create player_sessions table to store 4B scoring data
CREATE TABLE public.player_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  reboot_session_id TEXT,
  session_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  session_source TEXT DEFAULT 'manual',
  
  -- 4B Scores (20-80 scale)
  brain_score INTEGER,
  body_score INTEGER,
  bat_score INTEGER,
  ball_score INTEGER,
  overall_score INTEGER,
  
  -- Grades
  brain_grade TEXT,
  body_grade TEXT,
  bat_grade TEXT,
  ball_grade TEXT,
  overall_grade TEXT,
  
  -- Flow Components
  ground_flow INTEGER,
  core_flow INTEGER,
  upper_flow INTEGER,
  
  -- Leak Detection
  leak_type TEXT,
  leak_caption TEXT,
  leak_training TEXT,
  
  -- Metadata
  swing_count INTEGER DEFAULT 1,
  data_quality TEXT DEFAULT 'limited',
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX idx_player_sessions_player_id ON public.player_sessions(player_id);
CREATE INDEX idx_player_sessions_session_date ON public.player_sessions(session_date DESC);
CREATE INDEX idx_player_sessions_reboot_session_id ON public.player_sessions(reboot_session_id);

-- Enable RLS
ALTER TABLE public.player_sessions ENABLE ROW LEVEL SECURITY;

-- Policies for admin access
CREATE POLICY "Admins can manage player_sessions"
ON public.player_sessions
FOR ALL
USING (public.is_admin());

-- Policy for authenticated users to read (coaches need to view player data)
CREATE POLICY "Authenticated users can read player_sessions"
ON public.player_sessions
FOR SELECT
TO authenticated
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_player_sessions_updated_at
BEFORE UPDATE ON public.player_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();