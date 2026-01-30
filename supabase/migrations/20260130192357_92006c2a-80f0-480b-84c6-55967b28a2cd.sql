-- Create player_stack_data table for Stack System training data
CREATE TABLE public.player_stack_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Program Info
  program_name TEXT,
  sessions_completed INT,
  total_swings INT,
  
  -- Key Metrics
  bat_speed_start DECIMAL,
  bat_speed_current DECIMAL,
  distance_potential DECIMAL,
  grit_score_avg DECIMAL,
  health_energy_avg DECIMAL,
  
  -- Force-Velocity Profile
  responder_type TEXT CHECK (responder_type IN ('overspeed', 'overload', 'balanced', NULL)),
  best_light_speed DECIMAL,
  best_heavy_speed DECIMAL,
  
  -- Session Data (JSON array)
  session_data JSONB DEFAULT '[]'::jsonb,
  
  -- Personal Bests (JSON object)
  personal_bests JSONB DEFAULT '{}'::jsonb,
  
  -- Notes
  coaching_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.player_stack_data ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all Stack data
CREATE POLICY "Authenticated users can view player_stack_data"
ON public.player_stack_data
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to insert/update/delete
CREATE POLICY "Authenticated users can manage player_stack_data"
ON public.player_stack_data
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Index for fast player lookups
CREATE INDEX idx_player_stack_data_player_id ON public.player_stack_data(player_id);
CREATE INDEX idx_player_stack_data_recorded_at ON public.player_stack_data(recorded_at DESC);