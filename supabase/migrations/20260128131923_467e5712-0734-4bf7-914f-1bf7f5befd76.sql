-- Create system_settings table for global configuration
CREATE TABLE public.system_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_name TEXT NOT NULL UNIQUE,
  setting_value BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by TEXT
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Allow service_role full access (edge functions use this)
CREATE POLICY "Service role has full access to system_settings"
ON public.system_settings
FOR ALL
USING (true)
WITH CHECK (true);

-- Insert default kill switch setting (enabled by default)
INSERT INTO public.system_settings (setting_name, setting_value, updated_by)
VALUES ('coach_api_enabled', true, 'system_init');