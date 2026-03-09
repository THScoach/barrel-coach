CREATE POLICY "Players can read own record by email"
ON public.players
FOR SELECT
TO authenticated
USING (email = (auth.jwt() ->> 'email'));