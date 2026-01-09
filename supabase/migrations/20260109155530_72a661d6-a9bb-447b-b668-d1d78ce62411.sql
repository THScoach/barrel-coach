-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- SESSIONS TABLE
-- One record per analysis purchase
-- ============================================
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Product Info
  product_type VARCHAR(20) NOT NULL CHECK (product_type IN ('single_swing', 'complete_review')),
  price_cents INTEGER NOT NULL,
  
  -- Player Info
  player_name VARCHAR(100) NOT NULL,
  player_age INTEGER NOT NULL CHECK (player_age >= 5 AND player_age <= 50),
  player_email VARCHAR(255) NOT NULL,
  player_level VARCHAR(20) NOT NULL CHECK (player_level IN ('youth', 'travel', 'middle_school', 'hs_jv', 'hs_varsity', 'college', 'pro')),
  
  -- Session Settings
  environment VARCHAR(20) NOT NULL CHECK (environment IN ('tee', 'soft_toss', 'front_toss', 'bp', 'machine', 'live')),
  swings_required INTEGER NOT NULL DEFAULT 1,
  
  -- Status Flow: pending_upload → uploading → pending_payment → paid → analyzing → complete → failed
  status VARCHAR(20) NOT NULL DEFAULT 'pending_upload' CHECK (status IN ('pending_upload', 'uploading', 'pending_payment', 'paid', 'analyzing', 'complete', 'failed')),
  
  -- Aggregated Results (filled after analysis)
  composite_score DECIMAL(5,2),
  grade VARCHAR(20),
  four_b_brain DECIMAL(5,2),
  four_b_body DECIMAL(5,2),
  four_b_bat DECIMAL(5,2),
  four_b_ball DECIMAL(5,2),
  
  -- Weakest Category (for "Your Problem" section)
  weakest_category VARCHAR(10) CHECK (weakest_category IN ('brain', 'body', 'bat', 'ball')),
  
  -- Consistency Metrics (Complete Review only)
  consistency_mean DECIMAL(5,2),
  consistency_std_dev DECIMAL(5,2),
  consistency_cv DECIMAL(5,2),
  best_swing_index INTEGER,
  best_swing_score DECIMAL(5,2),
  worst_swing_index INTEGER,
  worst_swing_score DECIMAL(5,2),
  
  -- Percentile (compared to age group)
  percentile INTEGER CHECK (percentile >= 0 AND percentile <= 100),
  
  -- Report
  report_url TEXT,
  report_storage_path TEXT,
  
  -- Payment (Stripe)
  stripe_checkout_session_id VARCHAR(100),
  stripe_payment_intent_id VARCHAR(100),
  paid_at TIMESTAMP WITH TIME ZONE,
  
  -- Full Analysis JSON (stores everything for report generation)
  analysis_json JSONB,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  analyzed_at TIMESTAMP WITH TIME ZONE,
  
  -- Optional: Link to authenticated user
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ============================================
-- SWINGS TABLE
-- Individual swing videos within a session
-- ============================================
CREATE TABLE swings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  swing_index INTEGER NOT NULL CHECK (swing_index >= 0 AND swing_index <= 19),
  
  -- Video File
  video_url TEXT,
  video_storage_path TEXT,
  video_filename VARCHAR(255),
  video_size_bytes INTEGER,
  video_duration_seconds DECIMAL(5,2),
  
  -- Validation
  validation_passed BOOLEAN DEFAULT FALSE,
  validation_errors JSONB,
  
  -- Analysis Status: pending → analyzing → complete → failed
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'analyzing', 'complete', 'failed')),
  
  -- Individual Swing Scores
  composite_score DECIMAL(5,2),
  grade VARCHAR(20),
  four_b_brain DECIMAL(5,2),
  four_b_body DECIMAL(5,2),
  four_b_bat DECIMAL(5,2),
  four_b_ball DECIMAL(5,2),
  
  -- Full Analysis JSON for this swing
  analysis_json JSONB,
  
  -- Timestamps
  uploaded_at TIMESTAMP WITH TIME ZONE,
  analyzed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique swing index per session
  UNIQUE(session_id, swing_index)
);

-- ============================================
-- REPORTS TABLE (Optional - for tracking generated PDFs)
-- ============================================
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  
  report_type VARCHAR(20) NOT NULL CHECK (report_type IN ('single_swing', 'complete_review')),
  report_url TEXT NOT NULL,
  report_storage_path TEXT,
  
  -- Email delivery tracking
  emailed_to VARCHAR(255),
  emailed_at TIMESTAMP WITH TIME ZONE,
  email_status VARCHAR(20) DEFAULT 'pending' CHECK (email_status IN ('pending', 'sent', 'failed', 'bounced')),
  
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_email ON sessions(player_email);
CREATE INDEX idx_sessions_created ON sessions(created_at DESC);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_swings_session ON swings(session_id);
CREATE INDEX idx_swings_status ON swings(status);
CREATE INDEX idx_reports_session ON reports(session_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE swings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can create a session (for anonymous checkout)
CREATE POLICY "Anyone can create sessions" ON sessions
  FOR INSERT WITH CHECK (true);

-- Policy: Sessions are viewable by session ID (for results page)
CREATE POLICY "Sessions viewable by anyone with ID" ON sessions
  FOR SELECT USING (true);

-- Policy: Sessions updatable by service role only (via edge functions)
CREATE POLICY "Sessions updatable by service role" ON sessions
  FOR UPDATE USING (auth.role() = 'service_role');

-- Policy: Swings follow session rules
CREATE POLICY "Anyone can create swings" ON swings
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Swings viewable with session" ON swings
  FOR SELECT USING (true);

CREATE POLICY "Swings updatable by service role" ON swings
  FOR UPDATE USING (auth.role() = 'service_role');

-- Policy: Reports follow session rules
CREATE POLICY "Reports viewable with session" ON reports
  FOR SELECT USING (true);

CREATE POLICY "Reports insertable by service role" ON reports
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Function to calculate session aggregates from swings
CREATE OR REPLACE FUNCTION calculate_session_aggregates(p_session_id UUID)
RETURNS VOID AS $$
DECLARE
  v_swings RECORD;
  v_count INTEGER;
  v_sum_score DECIMAL;
  v_sum_brain DECIMAL;
  v_sum_body DECIMAL;
  v_sum_bat DECIMAL;
  v_sum_ball DECIMAL;
  v_scores DECIMAL[];
  v_mean DECIMAL;
  v_std_dev DECIMAL;
  v_cv DECIMAL;
  v_best_index INTEGER;
  v_best_score DECIMAL;
  v_worst_index INTEGER;
  v_worst_score DECIMAL;
  v_weakest VARCHAR(10);
  v_grade VARCHAR(20);
BEGIN
  -- Get swing data
  SELECT 
    COUNT(*),
    COALESCE(SUM(composite_score), 0),
    COALESCE(SUM(four_b_brain), 0),
    COALESCE(SUM(four_b_body), 0),
    COALESCE(SUM(four_b_bat), 0),
    COALESCE(SUM(four_b_ball), 0),
    ARRAY_AGG(composite_score ORDER BY swing_index)
  INTO v_count, v_sum_score, v_sum_brain, v_sum_body, v_sum_bat, v_sum_ball, v_scores
  FROM swings
  WHERE session_id = p_session_id AND status = 'complete';
  
  IF v_count = 0 THEN
    RETURN;
  END IF;
  
  -- Calculate means
  v_mean := v_sum_score / v_count;
  
  -- Calculate std dev
  SELECT STDDEV(composite_score) INTO v_std_dev
  FROM swings WHERE session_id = p_session_id AND status = 'complete';
  
  -- Calculate CV
  IF v_mean > 0 THEN
    v_cv := (v_std_dev / v_mean) * 100;
  END IF;
  
  -- Find best and worst
  SELECT swing_index, composite_score INTO v_best_index, v_best_score
  FROM swings WHERE session_id = p_session_id AND status = 'complete'
  ORDER BY composite_score DESC LIMIT 1;
  
  SELECT swing_index, composite_score INTO v_worst_index, v_worst_score
  FROM swings WHERE session_id = p_session_id AND status = 'complete'
  ORDER BY composite_score ASC LIMIT 1;
  
  -- Determine weakest category
  SELECT 
    CASE 
      WHEN v_sum_brain <= LEAST(v_sum_body, v_sum_bat, v_sum_ball) THEN 'brain'
      WHEN v_sum_body <= LEAST(v_sum_brain, v_sum_bat, v_sum_ball) THEN 'body'
      WHEN v_sum_bat <= LEAST(v_sum_brain, v_sum_body, v_sum_ball) THEN 'bat'
      ELSE 'ball'
    END INTO v_weakest;
  
  -- Determine grade
  SELECT 
    CASE 
      WHEN v_mean >= 80 THEN 'Elite'
      WHEN v_mean >= 70 THEN 'Excellent'
      WHEN v_mean >= 60 THEN 'Above Avg'
      WHEN v_mean >= 50 THEN 'Average'
      WHEN v_mean >= 40 THEN 'Below Avg'
      ELSE 'Needs Work'
    END INTO v_grade;
  
  -- Update session
  UPDATE sessions SET
    composite_score = v_mean,
    grade = v_grade,
    four_b_brain = v_sum_brain / v_count,
    four_b_body = v_sum_body / v_count,
    four_b_bat = v_sum_bat / v_count,
    four_b_ball = v_sum_ball / v_count,
    weakest_category = v_weakest,
    consistency_mean = v_mean,
    consistency_std_dev = COALESCE(v_std_dev, 0),
    consistency_cv = COALESCE(v_cv, 0),
    best_swing_index = v_best_index,
    best_swing_score = v_best_score,
    worst_swing_index = v_worst_index,
    worst_swing_score = v_worst_score
  WHERE id = p_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STORAGE BUCKETS
-- ============================================

-- Create bucket for swing videos (private, 100MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('swing-videos', 'swing-videos', false, 104857600, ARRAY['video/mp4', 'video/quicktime']);

-- Create bucket for generated reports (private, 10MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('reports', 'reports', false, 10485760, ARRAY['application/pdf']);

-- ============================================
-- STORAGE POLICIES
-- ============================================

-- Allow anyone to upload swing videos (anonymous checkout)
CREATE POLICY "Anyone can upload swing videos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'swing-videos');

-- Allow anyone to read swing videos by path
CREATE POLICY "Anyone can read swing videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'swing-videos');

-- Allow service role to manage reports
CREATE POLICY "Service role can manage reports"
ON storage.objects FOR ALL
USING (bucket_id = 'reports');

-- Allow anyone to read reports (via signed URLs)
CREATE POLICY "Anyone can read reports"
ON storage.objects FOR SELECT
USING (bucket_id = 'reports');