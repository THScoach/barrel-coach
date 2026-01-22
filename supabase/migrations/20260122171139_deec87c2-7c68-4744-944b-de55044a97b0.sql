-- Fix player_video_prescriptions: Add service role access for Edge Functions
-- This ensures score-monitor can insert video prescriptions

-- First check if service role policy exists and add if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'player_video_prescriptions' 
    AND policyname = 'Service role full access to prescriptions'
  ) THEN
    CREATE POLICY "Service role full access to prescriptions"
      ON public.player_video_prescriptions
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- Ensure messages table has service role for INSERT with proper WITH CHECK
DROP POLICY IF EXISTS "Messages insertable by service role" ON public.messages;
CREATE POLICY "Messages insertable by service role"
  ON public.messages
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (auth.role() = 'service_role');

-- Ensure sms_logs table has service role for INSERT with proper WITH CHECK  
DROP POLICY IF EXISTS "Logs insertable by service role" ON public.sms_logs;
CREATE POLICY "Logs insertable by service role"
  ON public.sms_logs
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (auth.role() = 'service_role');

-- Ensure locker_room_messages service role INSERT policy has WITH CHECK
DROP POLICY IF EXISTS "Service role can insert locker room messages" ON public.locker_room_messages;
CREATE POLICY "Service role can insert locker room messages"
  ON public.locker_room_messages
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (auth.role() = 'service_role');