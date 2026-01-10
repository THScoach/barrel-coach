-- Create player_profiles table
CREATE TABLE public.player_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Basic Info
  first_name TEXT NOT NULL,
  last_name TEXT,
  
  -- Baseball Info
  organization TEXT,
  current_team TEXT,
  level TEXT,
  position TEXT,
  bats TEXT,
  throws TEXT,
  
  -- Demographics
  age INTEGER,
  birth_date DATE,
  height TEXT,
  weight INTEGER,
  hometown TEXT,
  
  -- External IDs (for future AI research)
  mlb_id TEXT,
  fangraphs_id TEXT,
  baseball_reference_id TEXT,
  milb_id TEXT,
  
  -- Contact
  email TEXT,
  phone TEXT,
  parent_name TEXT,
  parent_phone TEXT,
  parent_email TEXT,
  
  -- Stats Cache (for AI-fetched data)
  stats_json JSONB,
  stats_updated_at TIMESTAMPTZ,
  
  -- Scouting Info
  scouting_grades JSONB,
  scouting_reports TEXT[],
  
  -- Coach Rick's Notes
  coach_notes TEXT,
  training_history TEXT,
  known_issues TEXT[],
  current_focus TEXT,
  
  -- Intake Responses
  intake_responses JSONB,
  intake_completed_at TIMESTAMPTZ,
  
  -- Relationship
  first_session_date DATE,
  total_sessions INTEGER DEFAULT 0,
  lifetime_value INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_researched_at TIMESTAMPTZ
);

-- Create full-text search index on player name
CREATE INDEX idx_player_profiles_name ON player_profiles 
  USING gin(to_tsvector('english', coalesce(first_name, '') || ' ' || coalesce(last_name, '')));

-- Create index for active players
CREATE INDEX idx_player_profiles_active ON player_profiles(is_active) WHERE is_active = true;

-- Add player_id to sessions table
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS player_id UUID REFERENCES public.player_profiles(id);

-- Create index for sessions by player
CREATE INDEX IF NOT EXISTS idx_sessions_player ON sessions(player_id);

-- Enable RLS on player_profiles
ALTER TABLE public.player_profiles ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Player profiles manageable by service role" 
  ON public.player_profiles 
  FOR ALL 
  USING (auth.role() = 'service_role');

-- Admins can view player profiles (need is_admin function)
CREATE POLICY "Admins can view player profiles" 
  ON public.player_profiles 
  FOR SELECT 
  USING (public.is_admin());

CREATE POLICY "Admins can insert player profiles" 
  ON public.player_profiles 
  FOR INSERT 
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update player profiles" 
  ON public.player_profiles 
  FOR UPDATE 
  USING (public.is_admin());

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_player_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_player_profiles_updated_at
  BEFORE UPDATE ON public.player_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_player_profile_updated_at();