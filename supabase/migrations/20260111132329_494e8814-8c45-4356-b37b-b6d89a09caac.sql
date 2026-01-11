-- Add privacy-safe session summary fields for Training Visualizer
ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS swing_count integer,
ADD COLUMN IF NOT EXISTS has_contact_event boolean,
ADD COLUMN IF NOT EXISTS leak_type varchar(50);

-- Drop existing function first to allow return type changes
DROP FUNCTION IF EXISTS public.get_session_public_data(uuid);

-- Recreate with new privacy-safe fields for Training Visualizer
CREATE OR REPLACE FUNCTION public.get_session_public_data(session_id_param uuid)
RETURNS TABLE(
  id uuid,
  player_name text,
  composite_score numeric,
  grade character varying,
  four_b_brain numeric,
  four_b_body numeric,
  four_b_bat numeric,
  four_b_ball numeric,
  weakest_category character varying,
  status character varying,
  product_type character varying,
  swing_count integer,
  has_contact_event boolean,
  leak_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    CAST(split_part(s.player_name, ' ', 1) AS text) as player_name,
    s.composite_score,
    s.grade,
    s.four_b_brain,
    s.four_b_body,
    s.four_b_bat,
    s.four_b_ball,
    s.weakest_category,
    s.status,
    s.product_type,
    -- Privacy-safe summary fields (no raw Reboot data)
    COALESCE(
      s.swing_count,
      (SELECT COUNT(*)::integer FROM swings sw WHERE sw.session_id = s.id AND sw.status = 'complete')
    ) as swing_count,
    COALESCE(s.has_contact_event, true) as has_contact_event,
    COALESCE(
      s.leak_type,
      (SELECT sa.primary_problem FROM swing_analyses sa WHERE sa.session_id = s.id LIMIT 1)
    )::text as leak_type
  FROM sessions s
  WHERE s.id = session_id_param;
END;
$$;