-- Remove the overly permissive SELECT policy on xp_log
DROP POLICY IF EXISTS "XP log viewable by all" ON public.xp_log;

-- The correct policy "Players can view own xp_log or admins can view all" already exists
-- with proper restriction: (auth.uid() = player_id) OR is_admin()