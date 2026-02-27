
-- Add 8 sub-score columns
ALTER TABLE public.video_2d_sessions
  ADD COLUMN ground_connection smallint,
  ADD COLUMN hip_rotation smallint,
  ADD COLUMN sequence_quality smallint,
  ADD COLUMN timing_estimate smallint,
  ADD COLUMN attack_angle smallint,
  ADD COLUMN barrel_control smallint,
  ADD COLUMN hand_path smallint,
  ADD COLUMN power_estimate smallint;

-- Backfill from analysis_json
UPDATE public.video_2d_sessions
SET
  ground_connection = (analysis_json->'body_components'->>'ground_connection')::smallint,
  hip_rotation = (analysis_json->'body_components'->>'hip_rotation')::smallint,
  sequence_quality = (analysis_json->'body_components'->>'sequence_quality')::smallint,
  timing_estimate = (analysis_json->'brain_components'->>'timing_estimate')::smallint,
  attack_angle = (analysis_json->'bat_components'->>'attack_angle')::smallint,
  barrel_control = (analysis_json->'bat_components'->>'barrel_control')::smallint,
  hand_path = (analysis_json->'bat_components'->>'hand_path')::smallint,
  power_estimate = (analysis_json->'ball_components'->>'power_estimate')::smallint
WHERE analysis_json IS NOT NULL;
