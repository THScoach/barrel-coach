-- Fix the overly permissive INSERT policy
DROP POLICY IF EXISTS "Service can insert reports" ON public.game_weekly_reports;

-- Create a more restrictive insert policy that allows authenticated users to insert their own reports
-- or allows the system (service role) to insert
CREATE POLICY "Players can insert own reports"
  ON public.game_weekly_reports
  FOR INSERT
  WITH CHECK (
    player_id IN (
      SELECT id FROM public.players WHERE email = auth.jwt()->>'email'
    )
  );