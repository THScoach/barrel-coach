-- Create player_blast_data table for Blast Motion sensor data
CREATE TABLE public.player_blast_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Session Info
  session_date DATE,
  swings_count INT,
  
  -- Key Metrics
  bat_speed_avg DECIMAL,
  bat_speed_max DECIMAL,
  hand_speed_avg DECIMAL,
  time_to_contact DECIMAL,
  attack_angle DECIMAL,
  vertical_angle DECIMAL,
  on_plane_efficiency DECIMAL,
  power_avg DECIMAL,
  rotation_score DECIMAL,
  
  -- Raw session data
  session_data JSONB DEFAULT '{}'::jsonb,
  
  -- Notes
  coaching_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.player_blast_data ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all Blast data
CREATE POLICY "Authenticated users can view player_blast_data"
ON public.player_blast_data
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to insert/update/delete
CREATE POLICY "Authenticated users can manage player_blast_data"
ON public.player_blast_data
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Indexes for fast lookups
CREATE INDEX idx_player_blast_data_player_id ON public.player_blast_data(player_id);
CREATE INDEX idx_player_blast_data_session_date ON public.player_blast_data(session_date DESC);
CREATE INDEX idx_player_blast_data_recorded_at ON public.player_blast_data(recorded_at DESC);