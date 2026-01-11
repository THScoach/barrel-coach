-- Fix the security definer view issue by recreating with SECURITY INVOKER
DROP VIEW IF EXISTS public.practice_summary_30d;

CREATE VIEW public.practice_summary_30d 
WITH (security_invoker = true) AS
SELECT 
  player_id,
  COUNT(*) AS total_events,
  ROUND(AVG(exit_velocity)::numeric, 1) AS avg_ev,
  ROUND(AVG(launch_angle)::numeric, 1) AS avg_la,
  ROUND(100.0 * SUM(CASE WHEN is_hard_hit THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) AS hard_hit_pct,
  ROUND(100.0 * SUM(CASE WHEN is_sweet_spot THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) AS sweet_spot_pct,
  ROUND(100.0 * SUM(CASE WHEN is_barrel THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) AS barrel_pct,
  ROUND(AVG(contact_score)::numeric, 1) AS avg_contact_score,
  ROUND(100.0 * SUM(CASE WHEN bb_type = 'GB' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) AS gb_pct,
  ROUND(100.0 * SUM(CASE WHEN bb_type = 'LD' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) AS ld_pct,
  ROUND(100.0 * SUM(CASE WHEN bb_type = 'FB' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) AS fb_pct
FROM public.batted_ball_events
WHERE event_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY player_id;