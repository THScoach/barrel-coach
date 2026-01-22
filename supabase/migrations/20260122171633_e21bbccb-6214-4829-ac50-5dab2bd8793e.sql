-- Fix security issues for tables exposing sensitive data

-- 1. Fix waitlist: Remove public SELECT access (already has admin-only SELECT)
-- No change needed - waitlist already has proper policies

-- 2. Fix pending_reboot_queue: This is a VIEW, need to secure the base table or recreate view
-- First check what type it is
-- The pending_reboot_queue is already a VIEW with security_invoker = true, so it respects RLS

-- 3. Fix sensor_swings: Restrict to player's own data or admins
DROP POLICY IF EXISTS "Sensor swings viewable by all authenticated users" ON public.sensor_swings;

CREATE POLICY "Players can view their own sensor swings" 
  ON public.sensor_swings 
  FOR SELECT 
  USING (
    player_id IN (
      SELECT p.id FROM players p WHERE p.email = (auth.jwt() ->> 'email')
    )
    OR is_admin()
    OR auth.role() = 'service_role'
  );

-- 4. Ensure sms_logs has UPDATE policy for service role (for status updates)
DROP POLICY IF EXISTS "Service role can update sms_logs" ON public.sms_logs;
CREATE POLICY "Service role can update sms_logs"
  ON public.sms_logs
  FOR UPDATE
  USING (auth.role() = 'service_role');

-- 5. Ensure messages has full service role access for status updates
DROP POLICY IF EXISTS "Service role full access to messages" ON public.messages;
CREATE POLICY "Service role full access to messages"
  ON public.messages
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');