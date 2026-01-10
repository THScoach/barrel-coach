-- Table 1: players (new table for Reboot Motion players)
CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic Info
  name TEXT NOT NULL,
  level TEXT CHECK (level IN ('youth', 'high_school', 'college', 'pro', 'mlb')),
  age INTEGER,
  handedness TEXT CHECK (handedness IN ('left', 'right', 'switch')),
  position TEXT,
  team TEXT,
  
  -- Physical
  height_inches DECIMAL(5,2),
  weight_lbs DECIMAL(5,2),
  
  -- Contact
  email TEXT,
  phone TEXT,
  
  -- Reboot Motion Link
  reboot_athlete_id TEXT UNIQUE,
  
  -- Settings
  is_public BOOLEAN DEFAULT false,
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for players
CREATE INDEX idx_players_name ON public.players(name);
CREATE INDEX idx_players_level ON public.players(level);
CREATE INDEX idx_players_reboot_id ON public.players(reboot_athlete_id);

-- Table 2: reboot_sessions
CREATE TABLE public.reboot_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Links
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
  reboot_session_id TEXT,
  
  -- Session Info
  session_date DATE,
  session_number INTEGER,
  location TEXT,
  notes TEXT,
  
  -- Files
  ik_file_path TEXT,
  me_file_path TEXT,
  
  -- Processing Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'error')),
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for reboot_sessions
CREATE INDEX idx_reboot_sessions_player ON public.reboot_sessions(player_id);
CREATE INDEX idx_reboot_sessions_date ON public.reboot_sessions(session_date DESC);
CREATE INDEX idx_reboot_sessions_status ON public.reboot_sessions(status);

-- Table 3: fourb_scores (4B scoring results)
CREATE TABLE public.fourb_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Links
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
  reboot_session_id UUID REFERENCES public.reboot_sessions(id) ON DELETE CASCADE,
  
  -- 4B Scores (20-80 scale)
  brain_score INTEGER CHECK (brain_score BETWEEN 20 AND 80),
  body_score INTEGER CHECK (body_score BETWEEN 20 AND 80),
  bat_score INTEGER CHECK (bat_score BETWEEN 20 AND 80),
  ball_score INTEGER CHECK (ball_score BETWEEN 20 AND 80),
  composite_score DECIMAL(4,1),
  
  -- Grade
  grade TEXT CHECK (grade IN ('Plus-Plus', 'Plus', 'Above Avg', 'Average', 'Below Avg', 'Fringe', 'Poor')),
  
  -- Sub-scores
  ground_flow_score INTEGER,
  core_flow_score INTEGER,
  upper_flow_score INTEGER,
  
  -- Key Metrics
  pelvis_velocity DECIMAL(6,2),
  torso_velocity DECIMAL(6,2),
  x_factor DECIMAL(5,2),
  bat_ke DECIMAL(6,2),
  transfer_efficiency DECIMAL(5,2),
  
  -- Consistency
  consistency_cv DECIMAL(5,2),
  consistency_grade TEXT,
  
  -- Weakest Link
  weakest_link TEXT CHECK (weakest_link IN ('brain', 'body', 'bat', 'ball')),
  
  -- Primary Issue
  primary_issue_title TEXT,
  primary_issue_description TEXT,
  primary_issue_category TEXT,
  
  -- Drill Prescription
  prescribed_drill_id UUID,
  prescribed_drill_name TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fourb_scores
CREATE INDEX idx_fourb_scores_player ON public.fourb_scores(player_id);
CREATE INDEX idx_fourb_scores_session ON public.fourb_scores(reboot_session_id);
CREATE INDEX idx_fourb_scores_date ON public.fourb_scores(created_at DESC);

-- Table 4: player_notes
CREATE TABLE public.player_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
  
  note TEXT NOT NULL,
  is_private BOOLEAN DEFAULT false,
  
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_player_notes_player ON public.player_notes(player_id);

-- Table 5: activity_log
CREATE TABLE public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  action TEXT NOT NULL,
  description TEXT,
  
  player_id UUID REFERENCES public.players(id),
  session_id UUID,
  
  metadata JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_log_created ON public.activity_log(created_at DESC);

-- Enable RLS on all new tables
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reboot_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fourb_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for players
CREATE POLICY "Service role full access to players" ON public.players
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Admins can manage players" ON public.players
  FOR ALL USING (public.is_admin());

CREATE POLICY "Public players viewable by everyone" ON public.players
  FOR SELECT USING (is_public = true);

-- RLS Policies for reboot_sessions
CREATE POLICY "Service role full access to reboot_sessions" ON public.reboot_sessions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Admins can manage reboot_sessions" ON public.reboot_sessions
  FOR ALL USING (public.is_admin());

-- RLS Policies for fourb_scores
CREATE POLICY "Service role full access to fourb_scores" ON public.fourb_scores
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Admins can manage fourb_scores" ON public.fourb_scores
  FOR ALL USING (public.is_admin());

-- RLS Policies for player_notes
CREATE POLICY "Service role full access to player_notes" ON public.player_notes
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Admins can manage player_notes" ON public.player_notes
  FOR ALL USING (public.is_admin());

-- RLS Policies for activity_log
CREATE POLICY "Service role full access to activity_log" ON public.activity_log
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Admins can view activity_log" ON public.activity_log
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Anyone can insert activity_log" ON public.activity_log
  FOR INSERT WITH CHECK (true);