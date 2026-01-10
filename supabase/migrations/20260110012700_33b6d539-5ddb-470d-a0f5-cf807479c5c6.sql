-- Fix sessions table security: restrict SELECT to only non-sensitive columns
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Sessions viewable by anyone with ID" ON public.sessions;

-- Create a more restrictive policy that only allows viewing sessions by the session owner
-- or by service role for admin purposes
CREATE POLICY "Sessions viewable by owner or service role"
ON public.sessions
FOR SELECT
USING (
  auth.role() = 'service_role'
  OR user_id = auth.uid()
);

-- Create a policy to allow public viewing of limited session data for results pages
-- This uses a function to prevent direct exposure of sensitive data
CREATE OR REPLACE FUNCTION public.get_session_public_data(session_id_param uuid)
RETURNS TABLE (
  id uuid,
  player_name text,
  composite_score numeric,
  grade varchar,
  four_b_brain numeric,
  four_b_body numeric,
  four_b_bat numeric,
  four_b_ball numeric,
  weakest_category varchar,
  status varchar,
  product_type varchar
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    CAST(split_part(s.player_name, ' ', 1) AS text) as player_name, -- Only first name
    s.composite_score,
    s.grade,
    s.four_b_brain,
    s.four_b_body,
    s.four_b_bat,
    s.four_b_ball,
    s.weakest_category,
    s.status,
    s.product_type
  FROM sessions s
  WHERE s.id = session_id_param;
END;
$$;