-- Create SELECT policy for xp_log: players can only see their own entries, admins can see all
CREATE POLICY "Players can view own xp_log or admins can view all"
ON public.xp_log
FOR SELECT
USING (
  auth.uid() = player_id 
  OR public.is_admin()
);