-- Remove any potentially conflicting SELECT policies and ensure only admin access
-- First drop all existing SELECT policies on waitlist
DROP POLICY IF EXISTS "Admins can view waitlist" ON public.waitlist;
DROP POLICY IF EXISTS "Only admins can view waitlist" ON public.waitlist;
DROP POLICY IF EXISTS "Anyone can join waitlist" ON public.waitlist;

-- Create a single, clear admin-only SELECT policy
CREATE POLICY "Only admins can view waitlist"
ON public.waitlist
FOR SELECT
TO authenticated
USING (public.is_admin());

-- Ensure INSERT remains public for signups (recreate to be explicit)
DROP POLICY IF EXISTS "Anyone can insert to waitlist" ON public.waitlist;
CREATE POLICY "Anyone can insert to waitlist"
ON public.waitlist
FOR INSERT
TO anon, authenticated
WITH CHECK (true);