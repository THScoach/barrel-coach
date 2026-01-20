-- =============================================================================
-- DRILL LIBRARY SCHEMA ENHANCEMENTS
-- =============================================================================

-- Add missing columns to drills table
ALTER TABLE drills ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
ALTER TABLE drills ADD COLUMN IF NOT EXISTS focus_area TEXT CHECK (focus_area IN ('ground_flow', 'core_flow', 'upper_flow', 'timing', 'consistency', 'general'));
ALTER TABLE drills ADD COLUMN IF NOT EXISTS video_thumbnail_url TEXT;
ALTER TABLE drills ADD COLUMN IF NOT EXISTS video_duration_seconds INTEGER;
ALTER TABLE drills ADD COLUMN IF NOT EXISTS why_it_works TEXT;
ALTER TABLE drills ADD COLUMN IF NOT EXISTS common_mistakes TEXT;
ALTER TABLE drills ADD COLUMN IF NOT EXISTS progression_tip TEXT;
ALTER TABLE drills ADD COLUMN IF NOT EXISTS skill_levels TEXT[] DEFAULT ARRAY['youth', 'high_school', 'college', 'pro'];
ALTER TABLE drills ADD COLUMN IF NOT EXISTS rest_seconds INTEGER DEFAULT 60;
ALTER TABLE drills ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE;
ALTER TABLE drills ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Update four_b_category check constraint
ALTER TABLE drills DROP CONSTRAINT IF EXISTS drills_four_b_category_check;
ALTER TABLE drills ADD CONSTRAINT drills_four_b_category_check CHECK (four_b_category IN ('brain', 'body', 'bat', 'ball', 'general'));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_drills_category ON drills(four_b_category);
CREATE INDEX IF NOT EXISTS idx_drills_focus ON drills(focus_area);
CREATE INDEX IF NOT EXISTS idx_drills_active ON drills(is_active);
CREATE INDEX IF NOT EXISTS idx_drills_slug ON drills(slug);

-- =============================================================================
-- DRILL PRESCRIPTIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS drill_prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drill_id UUID NOT NULL REFERENCES drills(id) ON DELETE CASCADE,
  leak_type TEXT CHECK (leak_type IN ('clean_transfer', 'late_legs', 'early_arms', 'torso_bypass', 'no_bat_delivery', 'unknown')),
  motor_profile TEXT CHECK (motor_profile IN ('spinner', 'whipper', 'slingshotter', 'pusher', 'titan')),
  four_b_weakness TEXT CHECK (four_b_weakness IN ('brain', 'body', 'bat', 'ball')),
  min_score_threshold INTEGER CHECK (min_score_threshold >= 20 AND min_score_threshold <= 80),
  priority INTEGER DEFAULT 10,
  prescription_reason TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prescriptions_leak ON drill_prescriptions(leak_type);
CREATE INDEX IF NOT EXISTS idx_prescriptions_profile ON drill_prescriptions(motor_profile);
CREATE INDEX IF NOT EXISTS idx_prescriptions_weakness ON drill_prescriptions(four_b_weakness);
CREATE INDEX IF NOT EXISTS idx_prescriptions_drill ON drill_prescriptions(drill_id);

-- =============================================================================
-- PLAYER DRILL ASSIGNMENTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS player_drill_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  drill_id UUID NOT NULL REFERENCES drills(id) ON DELETE CASCADE,
  session_id UUID,
  assigned_reason TEXT,
  leak_type_at_assignment TEXT,
  score_at_assignment INTEGER,
  status TEXT DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'completed', 'skipped')),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(player_id, drill_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_assignments_player ON player_drill_assignments(player_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON player_drill_assignments(status);
CREATE INDEX IF NOT EXISTS idx_assignments_drill ON player_drill_assignments(drill_id);

-- =============================================================================
-- MODIFY DRILL COMPLETIONS TABLE (add assignment_id if not exists)
-- =============================================================================

ALTER TABLE drill_completions ADD COLUMN IF NOT EXISTS assignment_id UUID REFERENCES player_drill_assignments(id) ON DELETE CASCADE;
ALTER TABLE drill_completions ADD COLUMN IF NOT EXISTS difficulty_rating INTEGER CHECK (difficulty_rating >= 1 AND difficulty_rating <= 5);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE drill_prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_drill_assignments ENABLE ROW LEVEL SECURITY;

-- Drills are viewable by all authenticated users
DROP POLICY IF EXISTS "Anyone can view active drills" ON drills;
CREATE POLICY "Anyone can view active drills" ON drills
  FOR SELECT USING (is_active = true);

-- Prescriptions viewable by all (to allow edge functions to query)
DROP POLICY IF EXISTS "Anyone can view prescriptions" ON drill_prescriptions;
CREATE POLICY "Anyone can view prescriptions" ON drill_prescriptions
  FOR SELECT USING (true);

-- Players can see their own assignments
DROP POLICY IF EXISTS "Players can view own assignments" ON player_drill_assignments;
CREATE POLICY "Players can view own assignments" ON player_drill_assignments
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Players can update own assignments" ON player_drill_assignments;
CREATE POLICY "Players can update own assignments" ON player_drill_assignments
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "System can insert assignments" ON player_drill_assignments;
CREATE POLICY "System can insert assignments" ON player_drill_assignments
  FOR INSERT WITH CHECK (true);

-- =============================================================================
-- HELPER FUNCTION: Get Prescribed Drills for a Player
-- =============================================================================

CREATE OR REPLACE FUNCTION get_prescribed_drills(
  p_player_id UUID,
  p_leak_type TEXT DEFAULT NULL,
  p_motor_profile TEXT DEFAULT NULL,
  p_weakest_b TEXT DEFAULT NULL,
  p_weakest_score INTEGER DEFAULT NULL
)
RETURNS TABLE (
  drill_id UUID,
  drill_name TEXT,
  drill_slug TEXT,
  video_url TEXT,
  instructions TEXT,
  sets INTEGER,
  reps INTEGER,
  why_it_works TEXT,
  prescription_reason TEXT,
  priority INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (d.id)
    d.id,
    d.name,
    d.slug,
    d.video_url,
    d.instructions,
    d.sets,
    d.reps,
    d.why_it_works,
    dp.prescription_reason,
    dp.priority
  FROM drills d
  JOIN drill_prescriptions dp ON d.id = dp.drill_id
  WHERE d.is_active = true
    AND dp.is_active = true
    AND (
      (dp.leak_type IS NOT NULL AND dp.leak_type = p_leak_type)
      OR (dp.motor_profile IS NOT NULL AND dp.motor_profile = p_motor_profile)
      OR (dp.four_b_weakness IS NOT NULL AND dp.four_b_weakness = p_weakest_b)
      OR (dp.min_score_threshold IS NOT NULL AND p_weakest_score IS NOT NULL AND p_weakest_score < dp.min_score_threshold)
    )
  ORDER BY d.id, dp.priority ASC;
END;
$$ LANGUAGE plpgsql STABLE;