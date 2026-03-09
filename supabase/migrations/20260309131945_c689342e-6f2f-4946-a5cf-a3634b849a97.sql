-- Allow players to read their own video prescriptions (via email match to players table)
CREATE POLICY "Players can read own video prescriptions"
ON public.player_video_prescriptions
FOR SELECT
TO authenticated
USING (
  player_id IN (
    SELECT id FROM public.players WHERE email = (auth.jwt() ->> 'email')
  )
);

-- Allow authenticated users to read drill videos (reference data)
CREATE POLICY "Authenticated users can read drill videos"
ON public.drill_videos
FOR SELECT
TO authenticated
USING (true);