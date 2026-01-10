-- Fix security issue #1: Remove overly permissive swings SELECT policy
DROP POLICY IF EXISTS "Swings viewable with session" ON public.swings;

-- The "Session owners can read swings" policy already exists and properly validates ownership
-- It uses: EXISTS (SELECT 1 FROM sessions WHERE sessions.id = swings.session_id AND (sessions.user_id = auth.uid() OR auth.role() = 'service_role'))

-- Fix security issue #2: Tighten sessions INSERT policy to require proper data
-- We can't require authentication since purchases happen before login,
-- but we can add a policy that restricts SELECT to prevent enumeration

-- First, let's verify the sessions are only viewable by owners or service role
-- The existing policy should be fine, but let's ensure it's restrictive

-- Also, add a more restrictive policy for sessions that don't have user_id yet
-- These should only be viewable via service role (edge functions) until claimed

DROP POLICY IF EXISTS "Sessions viewable by owner or service role" ON public.sessions;

CREATE POLICY "Sessions viewable by owner or service role" 
ON public.sessions 
FOR SELECT 
USING (
  auth.role() = 'service_role'::text 
  OR (user_id IS NOT NULL AND user_id = auth.uid())
);

-- Add policy to allow users to view their own sessions by session ID 
-- (for results pages accessed via direct link before login)
-- This uses the get_session_public_data function which only exposes safe fields
-- The full session data requires ownership or service role