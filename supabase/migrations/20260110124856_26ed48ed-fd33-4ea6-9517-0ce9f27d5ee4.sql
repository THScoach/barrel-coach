-- Create swing_analyses table for detailed analysis data
CREATE TABLE IF NOT EXISTS public.swing_analyses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
  
  -- 4B Scores (1-10 scale)
  brain_score INTEGER CHECK (brain_score >= 1 AND brain_score <= 10),
  body_score INTEGER CHECK (body_score >= 1 AND body_score <= 10),
  bat_score INTEGER CHECK (bat_score >= 1 AND bat_score <= 10),
  ball_score INTEGER CHECK (ball_score >= 1 AND ball_score <= 10),
  
  -- Overall Score (calculated: average of 4B)
  overall_score DECIMAL(3,1),
  
  -- Weakest Category (auto-determined)
  weakest_category TEXT,
  
  -- Problem Identification
  primary_problem TEXT NOT NULL,
  secondary_problems TEXT[],
  
  -- Motor Profile (optional, for complete review)
  motor_profile TEXT,
  
  -- Coach Notes
  coach_notes TEXT,
  private_notes TEXT,
  
  -- Recommended Drills (links to drill_videos)
  recommended_drill_ids UUID[],
  
  -- Report
  report_generated_at TIMESTAMPTZ,
  results_sent_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  analyzed_by UUID REFERENCES auth.users(id)
);

-- Create problem_tags reference table
CREATE TABLE IF NOT EXISTS public.problem_tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  severity_weight INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.swing_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.problem_tags ENABLE ROW LEVEL SECURITY;

-- RLS Policies for swing_analyses
CREATE POLICY "Analyses viewable by service role" ON public.swing_analyses
  FOR SELECT USING (auth.role() = 'service_role');

CREATE POLICY "Analyses insertable by service role" ON public.swing_analyses
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Analyses updatable by service role" ON public.swing_analyses
  FOR UPDATE USING (auth.role() = 'service_role');

-- RLS Policies for problem_tags (public read)
CREATE POLICY "Problem tags viewable by everyone" ON public.problem_tags
  FOR SELECT USING (true);

CREATE POLICY "Problem tags manageable by service role" ON public.problem_tags
  FOR ALL USING (auth.role() = 'service_role');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_swing_analyses_session ON public.swing_analyses(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status_created ON public.sessions(status, created_at DESC);

-- Seed problem tags
INSERT INTO public.problem_tags (name, display_name, category, description) VALUES
-- BODY Problems
('spinning_out', 'Spinning Out', 'body', 'Hips rotate too early, losing connection'),
('drifting', 'Drifting', 'body', 'Weight moves forward before rotation'),
('collapsing', 'Collapsing Back Side', 'body', 'Back leg collapses, losing ground force'),
('no_hip_hinge', 'No Hip Hinge', 'body', 'Standing too upright, no athletic load'),
('early_extension', 'Early Extension', 'body', 'Standing up out of posture before contact'),

-- BAT Problems
('casting', 'Casting', 'bat', 'Hands push out early, losing bat lag'),
('rolling_over', 'Rolling Over', 'bat', 'Top hand rolls over too early'),
('bat_drag', 'Bat Drag', 'bat', 'Barrel trails hands through zone'),
('long_swing', 'Long Swing', 'bat', 'Excessive hand path length'),
('no_extension', 'No Extension', 'bat', 'Arms chicken-wing at contact'),

-- BRAIN Problems  
('late_timing', 'Late Timing', 'brain', 'Consistently behind fastball'),
('early_timing', 'Early Timing', 'brain', 'Too far out front, rolling over'),
('chasing', 'Chasing', 'brain', 'Swinging at pitches outside zone'),
('guess_hitter', 'Guess Hitting', 'brain', 'Not recognizing pitch type'),
('no_plan', 'No Plan', 'brain', 'No approach or zone strategy'),

-- BALL Problems
('ground_balls', 'Ground Ball Problem', 'ball', 'Attack angle too negative'),
('pop_ups', 'Pop Up Problem', 'ball', 'Attack angle too steep'),
('no_power', 'No Power', 'ball', 'Low exit velocity for size/strength'),
('no_backspin', 'No Backspin', 'ball', 'Ball not carrying, wrong spin axis'),
('weak_contact', 'Weak Contact', 'ball', 'Mishits, foul balls, bad contact point')
ON CONFLICT (name) DO NOTHING;