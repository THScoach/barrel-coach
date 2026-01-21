-- Fix the overly permissive INSERT policy for ghost_sessions
-- Drop and recreate with proper restriction (only service role should insert via edge functions)
DROP POLICY IF EXISTS "Service role inserts ghost sessions" ON public.ghost_sessions;

-- Create a more restrictive policy - edge functions use service role which bypasses RLS anyway
-- For INSERT, we don't need a public policy since only edge functions will insert
CREATE POLICY "Players can insert ghost sessions"
  ON public.ghost_sessions FOR INSERT
  WITH CHECK (
    player_id IN (
      SELECT id FROM public.players WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
    OR public.is_admin()
  );