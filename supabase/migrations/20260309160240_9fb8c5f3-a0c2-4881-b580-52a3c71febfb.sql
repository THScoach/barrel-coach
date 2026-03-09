-- Drop all conflicting old policies that reference auth.users
DROP POLICY IF EXISTS "Players can view their prescriptions" ON public.player_video_prescriptions;
DROP POLICY IF EXISTS "Players can update their prescriptions" ON public.player_video_prescriptions;
DROP POLICY IF EXISTS "Admins manage all prescriptions" ON public.player_video_prescriptions;

-- Recreate admin policy without referencing auth.users
CREATE POLICY "Admins manage all prescriptions"
ON public.player_video_prescriptions
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Create UPDATE policy using JWT email (not auth.users)
CREATE POLICY "Players can update own prescriptions"
ON public.player_video_prescriptions
FOR UPDATE
TO authenticated
USING (
  player_id IN (
    SELECT id FROM public.players
    WHERE email = (auth.jwt() ->> 'email')
  )
)
WITH CHECK (
  player_id IN (
    SELECT id FROM public.players
    WHERE email = (auth.jwt() ->> 'email')
  )
);