-- Fix video_2d_batch_sessions RLS: add missing DELETE policy and fix admin with_check

-- Add DELETE policy for players (currently missing)
CREATE POLICY "Players can delete own batch sessions"
ON public.video_2d_batch_sessions
FOR DELETE
TO authenticated
USING (
  player_id IN (
    SELECT id FROM players WHERE email = (auth.jwt() ->> 'email')
  )
);

-- Drop and recreate admin policy with proper with_check
DROP POLICY IF EXISTS "Admins can manage all batch sessions" ON public.video_2d_batch_sessions;

CREATE POLICY "Admins can manage all batch sessions"
ON public.video_2d_batch_sessions
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());