-- Drop the existing overly permissive policy if it exists
DROP POLICY IF EXISTS "Anyone can join waitlist" ON public.waitlist;

-- Create INSERT policy for public signups (anyone can submit to waitlist)
CREATE POLICY "Anyone can insert to waitlist"
ON public.waitlist
FOR INSERT
WITH CHECK (true);

-- Create SELECT policy restricted to admins only
CREATE POLICY "Only admins can view waitlist"
ON public.waitlist
FOR SELECT
USING (public.is_admin());