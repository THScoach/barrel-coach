-- Drop and recreate view without SECURITY DEFINER (use SECURITY INVOKER explicitly)
DROP VIEW IF EXISTS pending_reboot_queue;

CREATE VIEW pending_reboot_queue 
WITH (security_invoker = on)
AS
SELECT 
  ru.id,
  ru.player_id,
  p.name as player_name,
  p.age as player_age,
  p.level as player_level,
  ru.created_at as uploaded_at,
  ru.composite_score as estimated_score,
  ru.grade as estimated_grade,
  ru.original_video_url,
  ru.video_2d_analysis,
  ru.leak_detected,
  ru.motor_profile,
  ru.analysis_confidence
FROM reboot_uploads ru
JOIN players p ON ru.player_id = p.id
WHERE ru.pending_reboot = true
  AND ru.analysis_type = '2d_video'
ORDER BY ru.created_at ASC;