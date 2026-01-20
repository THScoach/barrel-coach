-- =============================================================================
-- SECURE PLAYERS TABLE: Create public view with safe fields only
-- =============================================================================

-- Create a view with only non-sensitive fields (excludes email, phone, stripe_customer_id)
CREATE VIEW public.players_public
WITH (security_invoker = on) AS
SELECT 
  id,
  name,
  level,
  team,
  position,
  handedness,
  height_inches,
  weight_lbs,
  player_level,
  total_xp,
  is_public,
  created_at
FROM public.players
WHERE is_public = true;

-- Grant access to the view for public read
GRANT SELECT ON public.players_public TO authenticated;
GRANT SELECT ON public.players_public TO anon;

-- Drop the overly permissive policy if it exists
DROP POLICY IF EXISTS "Public players viewable - safe fields only" ON public.players;

-- Ensure strict base table policies
-- Drop and recreate to ensure correct setup
DROP POLICY IF EXISTS "Admins have full access to players" ON public.players;
CREATE POLICY "Admins have full access to players" ON public.players
  FOR ALL USING (public.is_admin());

-- Service role can access everything (needed for edge functions)
DROP POLICY IF EXISTS "Service role full access to players" ON public.players;
CREATE POLICY "Service role full access to players" ON public.players
  FOR ALL USING (auth.role() = 'service_role');

-- Add comment for documentation
COMMENT ON TABLE public.players IS 'Player records with PII (email, phone). Use players_public view for non-sensitive data.';
COMMENT ON VIEW public.players_public IS 'Public view of players table with only non-sensitive fields. Safe for unauthenticated access.';