-- Fix: players table public policy exposes sensitive fields
-- Replace overly permissive "is_public" policy with one that excludes PII

DROP POLICY IF EXISTS "Public players viewable with limited fields" ON public.players;

-- Create a view-based approach or use column-level security
-- Since Postgres doesn't support column-level RLS natively, we use a restrictive policy
-- Public viewers can only see: id, name, level, team, position, handedness, is_public
-- For PII access (email, phone, stripe_customer_id, notes), require admin/service role

CREATE POLICY "Public players viewable - safe fields only" 
ON public.players 
FOR SELECT 
USING (
  -- Admins and service role see everything
  auth.role() = 'service_role'::text 
  OR is_admin()
  -- For public players, only non-authenticated or limited access
  -- The policy allows SELECT but sensitive fields should be handled at application layer
  -- Since we can't do column-level RLS, we restrict to admin/service only for full access
  -- Public access is removed - they must go through secure edge functions
);

-- Note: This effectively makes players table admin/service-only
-- Public player data should be served via a secure RPC that selects only safe columns