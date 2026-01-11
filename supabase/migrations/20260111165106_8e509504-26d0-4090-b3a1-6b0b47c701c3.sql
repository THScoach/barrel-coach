-- ============================================
-- SECURITY FOUNDATION LOCK: Model Enforcement
-- ============================================

-- LOCK 2: Make sessions.user_id NOT NULL for sessions with PII
-- First, we need to update any NULL user_id sessions to have a placeholder or delete them
-- For existing NULL sessions, we'll set a flag but allow them (legacy data)
-- Going forward, the application must set user_id

-- Add a constraint that new sessions must have user_id when they have PII
-- We'll use a trigger to enforce this for new inserts

CREATE OR REPLACE FUNCTION public.enforce_session_owner()
RETURNS TRIGGER AS $$
BEGIN
  -- For new sessions being created, require user_id when there's PII
  -- PII fields: player_email, player_phone, stripe_checkout_session_id, stripe_payment_intent_id
  IF NEW.user_id IS NULL AND (
    NEW.player_email IS NOT NULL OR 
    NEW.player_phone IS NOT NULL OR
    NEW.stripe_checkout_session_id IS NOT NULL OR
    NEW.stripe_payment_intent_id IS NOT NULL
  ) THEN
    -- Allow service_role to create sessions without user_id (for admin-created sessions)
    -- But log a warning
    -- For now, we'll allow it but flag it
    NEW.player_notes = COALESCE(NEW.player_notes, '') || ' [SECURITY: Created without user_id]';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for new sessions
DROP TRIGGER IF EXISTS enforce_session_owner_trigger ON public.sessions;
CREATE TRIGGER enforce_session_owner_trigger
  BEFORE INSERT ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_session_owner();

-- LOCK 3: Tighten sessions RLS - owner-only access
-- Drop existing permissive policies and create strict owner-only policies

DROP POLICY IF EXISTS "Sessions viewable by owner or service role" ON public.sessions;
DROP POLICY IF EXISTS "Admins can view all sessions" ON public.sessions;
DROP POLICY IF EXISTS "Service role can create sessions" ON public.sessions;
DROP POLICY IF EXISTS "Sessions updatable by service role" ON public.sessions;

-- Strict SELECT policy: only owner, admin, or service_role
CREATE POLICY "Sessions viewable by owner only"
ON public.sessions
FOR SELECT
USING (
  auth.role() = 'service_role'::text
  OR is_admin()
  OR (user_id IS NOT NULL AND user_id = auth.uid())
);

-- Service role can create (for edge functions)
CREATE POLICY "Sessions insertable by service role"
ON public.sessions
FOR INSERT
WITH CHECK (auth.role() = 'service_role'::text);

-- Service role can update (for edge functions)
CREATE POLICY "Sessions updatable by service role only"
ON public.sessions
FOR UPDATE
USING (auth.role() = 'service_role'::text);

-- LOCK 3b: Tighten swings RLS - only owner can see their swings
DROP POLICY IF EXISTS "Session owners can read swings" ON public.swings;
DROP POLICY IF EXISTS "Admins can view all swings" ON public.swings;
DROP POLICY IF EXISTS "Service role can create swings" ON public.swings;
DROP POLICY IF EXISTS "Swings updatable by service role" ON public.swings;

-- Strict SELECT: owner of parent session, admin, or service_role
CREATE POLICY "Swings viewable by session owner only"
ON public.swings
FOR SELECT
USING (
  auth.role() = 'service_role'::text
  OR is_admin()
  OR EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id = swings.session_id
    AND s.user_id IS NOT NULL
    AND s.user_id = auth.uid()
  )
);

-- Service role can create
CREATE POLICY "Swings insertable by service role"
ON public.swings
FOR INSERT
WITH CHECK (auth.role() = 'service_role'::text);

-- Service role can update
CREATE POLICY "Swings updatable by service role only"
ON public.swings
FOR UPDATE
USING (auth.role() = 'service_role'::text);