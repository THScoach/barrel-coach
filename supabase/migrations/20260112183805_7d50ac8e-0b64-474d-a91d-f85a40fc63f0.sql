-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Service role can manage webhook logs" ON public.ghl_webhook_logs;

-- Create a more restrictive insert policy for authenticated users (edge functions use service role key which bypasses RLS)
-- The service role key automatically bypasses RLS, so we don't need an explicit policy for it
-- This table is only written to by edge functions using service role key