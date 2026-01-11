-- Drop existing function
DROP FUNCTION IF EXISTS public.get_session_public_data(uuid);

-- Recreate with NO subqueries - only session-level fields
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
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    s.id,
    split_part(s.player_name, ' ', 1)::text as player_name,
    s.composite_score,
    s.grade,
    s.four_b_brain,
    s.four_b_body,
    s.four_b_bat,
    s.four_b_ball,
    s.weakest_category,
    s.status,
    s.product_type,
    s.swing_count,
    s.has_contact_event,
    s.leak_type::text
  FROM sessions s
  WHERE s.id = session_id_param;
$$;