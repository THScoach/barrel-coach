
-- Drop any existing SELECT policies on player_video_prescriptions
DROP POLICY IF EXISTS "Players can read own video prescriptions" ON public.player_video_prescriptions;

-- Recreate with email-matching pattern (player_id references players.id, not auth.users.id)
CREATE POLICY "Players can read own video prescriptions"
ON public.player_video_prescriptions
FOR SELECT
TO authenticated
USING (
  player_id IN (
    SELECT id FROM public.players
    WHERE email = (auth.jwt() ->> 'email')
  )
);

-- Drop and recreate drill_videos SELECT policy
DROP POLICY IF EXISTS "Authenticated users can read drill videos" ON public.drill_videos;

CREATE POLICY "Authenticated users can read drill videos"
ON public.drill_videos
FOR SELECT
TO authenticated
USING (true);
