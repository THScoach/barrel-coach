-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a function to call the process-sms-triggers edge function
CREATE OR REPLACE FUNCTION public.trigger_process_sms()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url TEXT;
  v_service_key TEXT;
BEGIN
  -- Get the Supabase URL and service role key from vault or config
  v_url := current_setting('app.settings.supabase_url', true);
  v_service_key := current_setting('app.settings.service_role_key', true);
  
  -- If settings not available, use environment approach via edge function
  -- The edge function will be called directly by pg_cron
  PERFORM net.http_post(
    url := 'https://ggmuthqsybnfitsfyzxn.supabase.co/functions/v1/process-sms-triggers',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  
  RAISE LOG 'SMS trigger processing initiated';
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'SMS trigger processing failed: %', SQLERRM;
END;
$$;

-- Schedule the cron job to run every 5 minutes
SELECT cron.schedule(
  'process-sms-triggers',
  '*/5 * * * *',
  $$SELECT public.trigger_process_sms()$$
);