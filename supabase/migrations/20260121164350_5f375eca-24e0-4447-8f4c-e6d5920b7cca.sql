-- Fix SECURITY DEFINER views by recreating them with security_invoker = true
-- This ensures RLS policies of the querying user are respected

-- Drop and recreate players_public view with security invoker
DROP VIEW IF EXISTS public.players_public;
CREATE VIEW public.players_public
WITH (security_invoker = true)
AS SELECT 
    id,
    name,
    level,
    team,
    "position",
    handedness,
    height_inches,
    weight_lbs,
    player_level,
    total_xp,
    is_public,
    created_at
FROM players
WHERE is_public = true;

-- Drop and recreate unified_sessions view with security invoker
DROP VIEW IF EXISTS public.unified_sessions;
CREATE VIEW public.unified_sessions
WITH (security_invoker = true)
AS SELECT 
    vss.id,
    vss.player_id,
    vss.session_date,
    '2d_video'::text AS source_type,
    vss.composite_score,
    vss.brain_score,
    vss.body_score,
    vss.bat_score,
    vss.ball_score,
    vss.primary_leak,
    vss.weakest_link,
    vss.analyzed_count AS swing_count,
    vss.is_active,
    vss.ended_at,
    vss.validation_status,
    vss.correlated_reboot_id,
    vss.reboot_composite_delta,
    vss.accuracy_tier,
    vss.created_at,
    vss.updated_at
FROM video_swing_sessions vss
WHERE vss.is_active = false AND vss.composite_score IS NOT NULL
UNION ALL
SELECT 
    ru.id,
    ru.player_id,
    ru.session_date,
    '3d_reboot'::text AS source_type,
    ru.composite_score,
    ru.brain_score,
    ru.body_score,
    ru.bat_score,
    NULL::integer AS ball_score,
    ru.leak_detected AS primary_leak,
    ru.weakest_link,
    1 AS swing_count,
    false AS is_active,
    ru.completed_at AS ended_at,
    ru.validation_status,
    ru.correlated_video_session_id AS correlated_reboot_id,
    ru.video_composite_delta AS reboot_composite_delta,
    CASE
        WHEN abs(COALESCE(ru.video_composite_delta, 999::numeric)) < 5::numeric THEN 'high'::text
        WHEN abs(COALESCE(ru.video_composite_delta, 999::numeric)) < 10::numeric THEN 'medium'::text
        ELSE 'low'::text
    END AS accuracy_tier,
    ru.created_at,
    ru.updated_at
FROM reboot_uploads ru
WHERE ru.processing_status::text = 'complete'::text AND ru.composite_score IS NOT NULL;

-- Drop and recreate practice_summary_30d view with security invoker
DROP VIEW IF EXISTS public.practice_summary_30d;
CREATE VIEW public.practice_summary_30d
WITH (security_invoker = true)
AS SELECT 
    player_id,
    count(*) AS total_events,
    round(avg(exit_velocity), 1) AS avg_ev,
    round(avg(launch_angle), 1) AS avg_la,
    round(100.0 * sum(CASE WHEN is_hard_hit THEN 1 ELSE 0 END)::numeric / NULLIF(count(*), 0)::numeric, 1) AS hard_hit_pct,
    round(100.0 * sum(CASE WHEN is_sweet_spot THEN 1 ELSE 0 END)::numeric / NULLIF(count(*), 0)::numeric, 1) AS sweet_spot_pct,
    round(100.0 * sum(CASE WHEN is_barrel THEN 1 ELSE 0 END)::numeric / NULLIF(count(*), 0)::numeric, 1) AS barrel_pct,
    round(avg(contact_score), 1) AS avg_contact_score,
    round(100.0 * sum(CASE WHEN bb_type::text = 'GB'::text THEN 1 ELSE 0 END)::numeric / NULLIF(count(*), 0)::numeric, 1) AS gb_pct,
    round(100.0 * sum(CASE WHEN bb_type::text = 'LD'::text THEN 1 ELSE 0 END)::numeric / NULLIF(count(*), 0)::numeric, 1) AS ld_pct,
    round(100.0 * sum(CASE WHEN bb_type::text = 'FB'::text THEN 1 ELSE 0 END)::numeric / NULLIF(count(*), 0)::numeric, 1) AS fb_pct
FROM batted_ball_events
WHERE event_date >= (CURRENT_DATE - '30 days'::interval)
GROUP BY player_id;

-- Drop and recreate pending_reboot_queue view with security invoker
DROP VIEW IF EXISTS public.pending_reboot_queue;
CREATE VIEW public.pending_reboot_queue
WITH (security_invoker = true)
AS SELECT 
    ru.id,
    ru.player_id,
    p.name AS player_name,
    p.age AS player_age,
    p.level AS player_level,
    ru.created_at AS uploaded_at,
    ru.composite_score AS estimated_score,
    ru.grade AS estimated_grade,
    ru.original_video_url,
    ru.video_2d_analysis,
    ru.leak_detected,
    ru.motor_profile,
    ru.analysis_confidence
FROM reboot_uploads ru
JOIN players p ON ru.player_id = p.id
WHERE ru.pending_reboot = true AND ru.analysis_type::text = '2d_video'::text
ORDER BY ru.created_at;

-- Grant appropriate permissions
GRANT SELECT ON public.players_public TO anon, authenticated, service_role;
GRANT SELECT ON public.unified_sessions TO authenticated, service_role;
GRANT SELECT ON public.practice_summary_30d TO authenticated, service_role;
GRANT SELECT ON public.pending_reboot_queue TO authenticated, service_role;