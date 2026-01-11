-- Phase 4: Library System Tables

-- Create drills table (individual exercises)
CREATE TABLE public.drills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  four_b_category TEXT CHECK (four_b_category IN ('brain', 'body', 'bat', 'ball')),
  equipment TEXT[],
  duration_minutes INTEGER DEFAULT 15,
  sets INTEGER DEFAULT 3,
  reps INTEGER DEFAULT 10,
  video_url TEXT,
  thumbnail_url TEXT,
  instructions TEXT,
  cues TEXT[],
  difficulty TEXT DEFAULT 'beginner' CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create programs table (collections of drills)
CREATE TABLE public.programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  duration_weeks INTEGER DEFAULT 4,
  difficulty TEXT DEFAULT 'beginner' CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  four_b_focus TEXT[],
  is_template BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create program_schedule table (which drills on which days)
CREATE TABLE public.program_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID REFERENCES public.programs(id) ON DELETE CASCADE NOT NULL,
  drill_id UUID REFERENCES public.drills(id) ON DELETE CASCADE NOT NULL,
  week_number INTEGER NOT NULL CHECK (week_number >= 1),
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 1 AND day_of_week <= 7),
  order_index INTEGER DEFAULT 0,
  sets_override INTEGER,
  reps_override INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create player_programs table (program assignments to players)
CREATE TABLE public.player_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE NOT NULL,
  program_id UUID REFERENCES public.programs(id) ON DELETE CASCADE NOT NULL,
  started_at TIMESTAMPTZ DEFAULT now(),
  current_week INTEGER DEFAULT 1,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create drill_completions table (tracking individual drill completions)
CREATE TABLE public.drill_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE NOT NULL,
  drill_id UUID REFERENCES public.drills(id) ON DELETE CASCADE NOT NULL,
  player_program_id UUID REFERENCES public.player_programs(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ DEFAULT now(),
  sets_completed INTEGER,
  reps_completed INTEGER,
  duration_seconds INTEGER,
  notes TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5)
);

-- Create indexes for performance
CREATE INDEX idx_drills_category ON public.drills(four_b_category);
CREATE INDEX idx_drills_active ON public.drills(is_active);
CREATE INDEX idx_programs_active ON public.programs(is_active);
CREATE INDEX idx_program_schedule_program ON public.program_schedule(program_id);
CREATE INDEX idx_program_schedule_week_day ON public.program_schedule(week_number, day_of_week);
CREATE INDEX idx_player_programs_player ON public.player_programs(player_id);
CREATE INDEX idx_player_programs_status ON public.player_programs(status);
CREATE INDEX idx_drill_completions_player ON public.drill_completions(player_id);
CREATE INDEX idx_drill_completions_date ON public.drill_completions(completed_at);

-- Enable RLS on all tables
ALTER TABLE public.drills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drill_completions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for drills (admin-managed, viewable by all authenticated)
CREATE POLICY "Drills viewable by authenticated users"
ON public.drills FOR SELECT
USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "Drills manageable by admins"
ON public.drills FOR ALL
USING (is_admin());

CREATE POLICY "Service role full access to drills"
ON public.drills FOR ALL
USING (auth.role() = 'service_role');

-- RLS Policies for programs
CREATE POLICY "Programs viewable by authenticated users"
ON public.programs FOR SELECT
USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "Programs manageable by admins"
ON public.programs FOR ALL
USING (is_admin());

CREATE POLICY "Service role full access to programs"
ON public.programs FOR ALL
USING (auth.role() = 'service_role');

-- RLS Policies for program_schedule
CREATE POLICY "Program schedule viewable by authenticated users"
ON public.program_schedule FOR SELECT
USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "Program schedule manageable by admins"
ON public.program_schedule FOR ALL
USING (is_admin());

CREATE POLICY "Service role full access to program_schedule"
ON public.program_schedule FOR ALL
USING (auth.role() = 'service_role');

-- RLS Policies for player_programs
CREATE POLICY "Player programs viewable by admins"
ON public.player_programs FOR SELECT
USING (is_admin() OR auth.role() = 'service_role');

CREATE POLICY "Player programs manageable by admins"
ON public.player_programs FOR ALL
USING (is_admin());

CREATE POLICY "Service role full access to player_programs"
ON public.player_programs FOR ALL
USING (auth.role() = 'service_role');

-- RLS Policies for drill_completions
CREATE POLICY "Drill completions viewable by admins"
ON public.drill_completions FOR SELECT
USING (is_admin() OR auth.role() = 'service_role');

CREATE POLICY "Drill completions insertable by authenticated users"
ON public.drill_completions FOR INSERT
WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "Drill completions manageable by admins"
ON public.drill_completions FOR ALL
USING (is_admin());

CREATE POLICY "Service role full access to drill_completions"
ON public.drill_completions FOR ALL
USING (auth.role() = 'service_role');

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add triggers for updated_at
CREATE TRIGGER update_drills_updated_at
BEFORE UPDATE ON public.drills
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_programs_updated_at
BEFORE UPDATE ON public.programs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_player_programs_updated_at
BEFORE UPDATE ON public.player_programs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();