-- Drop existing fourb_scores table and replace with enhanced 4B KRS schema
-- First, drop foreign key constraints and indexes
DROP TABLE IF EXISTS fourb_scores CASCADE;

-- Create enhanced swing_4b_scores table (replaces fourb_scores)
CREATE TABLE public.swing_4b_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES reboot_sessions(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  swing_number INTEGER NOT NULL DEFAULT 1,
  
  -- 4B bucket scores (0-100 scale)
  b1_score NUMERIC, -- Rotational Foundation (pelvis & torso)
  b2_score NUMERIC, -- Proximal Load Transfer (ball-side hip)
  b3_score NUMERIC, -- Distal Ground Connection (ball-side knee/ankle)
  b4_score NUMERIC, -- Temporal Synchronization (phase errors)
  
  -- Aggregated 4B scores
  four_b_bat NUMERIC,  -- Bat-side KRS (0-100)
  four_b_ball NUMERIC, -- Ball-side KRS (0-100)
  four_b_hit NUMERIC,  -- Combined KRS (0-100)
  
  -- Bat speed metrics
  v_bat_actual_mph NUMERIC,    -- Measured bat speed at contact
  v_bat_expected_mph NUMERIC,  -- Predicted from KRS model
  mechanical_loss_mph NUMERIC, -- Expected - Actual
  mechanical_loss_pct NUMERIC, -- Percentage loss
  
  -- Diagnostic fields
  primary_bucket_issue TEXT CHECK (primary_bucket_issue IN ('B1', 'B2', 'B3', 'B4')),
  bucket_loss_breakdown JSONB DEFAULT '{}', -- {B1: 0.5, B2: 1.2, B3: 1.0, B4: 0.8}
  
  -- Legacy compatibility fields (from old fourb_scores)
  brain_score INTEGER,
  body_score INTEGER,
  bat_score INTEGER,
  ball_score INTEGER,
  composite_score NUMERIC,
  grade TEXT,
  weakest_link TEXT,
  
  -- Raw kinematic data (optional cache)
  pelvis_velocity NUMERIC,
  torso_velocity NUMERIC,
  x_factor NUMERIC,
  bat_ke NUMERIC,
  transfer_efficiency NUMERIC,
  
  -- Flow scores
  ground_flow_score INTEGER,
  core_flow_score INTEGER,
  upper_flow_score INTEGER,
  
  -- Consistency metrics
  consistency_cv NUMERIC,
  consistency_grade TEXT,
  
  -- Prescription
  primary_issue_title TEXT,
  primary_issue_description TEXT,
  primary_issue_category TEXT,
  prescribed_drill_id UUID REFERENCES drills(id),
  prescribed_drill_name TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create athlete KRS regression model table
CREATE TABLE public.athlete_krs_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE NOT NULL,
  
  -- Regression coefficients
  beta_0 NUMERIC NOT NULL DEFAULT 50,  -- Intercept (baseline bat speed)
  beta_1 NUMERIC NOT NULL DEFAULT 0.3, -- B1 coefficient
  beta_2 NUMERIC NOT NULL DEFAULT 0.3, -- B2 coefficient  
  beta_3 NUMERIC NOT NULL DEFAULT 0.25, -- B3 coefficient
  beta_4 NUMERIC NOT NULL DEFAULT 0.15, -- B4 coefficient
  
  -- Model quality
  r_squared NUMERIC,
  sample_count INTEGER DEFAULT 0,
  
  -- Timestamps
  calibrated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '90 days'),
  
  -- Ensure one model per player
  UNIQUE(player_id)
);

-- Create indexes for performance
CREATE INDEX idx_swing_4b_scores_session ON swing_4b_scores(session_id);
CREATE INDEX idx_swing_4b_scores_player ON swing_4b_scores(player_id);
CREATE INDEX idx_swing_4b_scores_created ON swing_4b_scores(created_at DESC);
CREATE INDEX idx_athlete_krs_models_player ON athlete_krs_models(player_id);

-- Enable RLS
ALTER TABLE swing_4b_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE athlete_krs_models ENABLE ROW LEVEL SECURITY;

-- RLS policies for swing_4b_scores
CREATE POLICY "Admins can manage swing_4b_scores"
  ON swing_4b_scores FOR ALL
  USING (is_admin());

CREATE POLICY "Service role full access to swing_4b_scores"
  ON swing_4b_scores FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Players can view own swing scores"
  ON swing_4b_scores FOR SELECT
  USING (player_id IN (
    SELECT id FROM players WHERE email = (auth.jwt() ->> 'email')
  ));

-- RLS policies for athlete_krs_models
CREATE POLICY "Admins can manage athlete_krs_models"
  ON athlete_krs_models FOR ALL
  USING (is_admin());

CREATE POLICY "Service role full access to athlete_krs_models"
  ON athlete_krs_models FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Players can view own KRS model"
  ON athlete_krs_models FOR SELECT
  USING (player_id IN (
    SELECT id FROM players WHERE email = (auth.jwt() ->> 'email')
  ));

-- Add updated_at trigger
CREATE TRIGGER update_swing_4b_scores_updated_at
  BEFORE UPDATE ON swing_4b_scores
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();