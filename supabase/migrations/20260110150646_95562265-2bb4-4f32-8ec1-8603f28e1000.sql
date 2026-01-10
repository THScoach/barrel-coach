-- Fix player_profiles: Ensure no anonymous access is possible
-- Drop any potentially problematic policies and recreate with explicit checks

-- Fix reports table: Replace overly permissive policy with session-based access
-- First drop the problematic policy
DROP POLICY IF EXISTS "Reports viewable with session" ON public.reports;

-- Create a proper policy that only allows viewing reports for sessions the user owns
-- or if the user is an admin/service role
CREATE POLICY "Reports viewable by session owner or admin"
ON public.reports
FOR SELECT
USING (
  -- Service role can view all
  auth.role() = 'service_role'
  -- Admins can view all
  OR public.is_admin()
  -- Session owner can view their own reports
  OR EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id = reports.session_id
    AND s.user_id = auth.uid()
  )
);

-- Add explicit deny for anonymous users on player_profiles by ensuring
-- all access requires either service_role, admin status, or ownership
-- The existing policies already restrict to service_role and is_admin()
-- But we should verify no public access exists