-- Fix overly permissive RLS on video_2d_batch_sessions table
-- Drop the existing permissive policy
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.video_2d_batch_sessions;

-- Admin full access
CREATE POLICY "Admins can manage all batch sessions"
ON public.video_2d_batch_sessions FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Service role full access (for edge functions)
CREATE POLICY "Service role full access to batch sessions"
ON public.video_2d_batch_sessions FOR ALL
USING (auth.role() = 'service_role');

-- Players can view their own sessions
CREATE POLICY "Players can view own batch sessions"
ON public.video_2d_batch_sessions FOR SELECT
USING (
  player_id IN (
    SELECT id FROM public.players 
    WHERE email = (auth.jwt() ->> 'email')
  )
);

-- Players can insert their own sessions
CREATE POLICY "Players can create own batch sessions"
ON public.video_2d_batch_sessions FOR INSERT
WITH CHECK (
  player_id IN (
    SELECT id FROM public.players 
    WHERE email = (auth.jwt() ->> 'email')
  )
);

-- Players can update only their own sessions
CREATE POLICY "Players can update own batch sessions"
ON public.video_2d_batch_sessions FOR UPDATE
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