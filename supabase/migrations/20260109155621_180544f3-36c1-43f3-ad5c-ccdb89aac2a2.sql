-- Fix function search_path for security
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

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
  
  v_mean := v_sum_score / v_count;
  
  SELECT STDDEV(composite_score) INTO v_std_dev
  FROM swings WHERE session_id = p_session_id AND status = 'complete';
  
  IF v_mean > 0 THEN
    v_cv := (v_std_dev / v_mean) * 100;
  END IF;
  
  SELECT swing_index, composite_score INTO v_best_index, v_best_score
  FROM swings WHERE session_id = p_session_id AND status = 'complete'
  ORDER BY composite_score DESC LIMIT 1;
  
  SELECT swing_index, composite_score INTO v_worst_index, v_worst_score
  FROM swings WHERE session_id = p_session_id AND status = 'complete'
  ORDER BY composite_score ASC LIMIT 1;
  
  SELECT 
    CASE 
      WHEN v_sum_brain <= LEAST(v_sum_body, v_sum_bat, v_sum_ball) THEN 'brain'
      WHEN v_sum_body <= LEAST(v_sum_brain, v_sum_bat, v_sum_ball) THEN 'body'
      WHEN v_sum_bat <= LEAST(v_sum_brain, v_sum_body, v_sum_ball) THEN 'bat'
      ELSE 'ball'
    END INTO v_weakest;
  
  SELECT 
    CASE 
      WHEN v_mean >= 80 THEN 'Elite'
      WHEN v_mean >= 70 THEN 'Excellent'
      WHEN v_mean >= 60 THEN 'Above Avg'
      WHEN v_mean >= 50 THEN 'Average'
      WHEN v_mean >= 40 THEN 'Below Avg'
      ELSE 'Needs Work'
    END INTO v_grade;
  
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;