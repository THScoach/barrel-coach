-- Create sms_templates table
CREATE TABLE public.sms_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trigger_name TEXT UNIQUE NOT NULL,
  message_body TEXT NOT NULL,
  delay_minutes INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies for sms_templates
CREATE POLICY "Templates viewable by service role" ON public.sms_templates
  FOR SELECT USING (auth.role() = 'service_role');

CREATE POLICY "Templates updatable by service role" ON public.sms_templates
  FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "Templates insertable by service role" ON public.sms_templates
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Seed templates
INSERT INTO public.sms_templates (trigger_name, message_body, delay_minutes, is_active) VALUES
('purchase_complete', 'Hey {{first_name}}! Got your order. Upload your swing video here and I''ll have your 4B analysis back within 24hrs: {{upload_link}} - Coach Rick', 0, true),
('no_upload_reminder', '{{first_name}} - haven''t seen your video yet. Need help recording? Just prop your phone up, side angle, and send it here: {{upload_link}} - Coach Rick', 1440, true),
('analysis_complete', '{{first_name}} - your Swing DNA report is ready! See your 4B scores here: {{results_link}} - Coach Rick', 0, true),
('follow_up', '{{first_name}} - how''s the training going? Hit reply if you have questions about your drills. - Coach Rick', 4320, true),
('upsell', '{{first_name}} - want me to go deeper on your swing? Upgrade to Complete Review and I''ll analyze 5 swings + give you a 30-day drill plan: {{upgrade_link}} - Coach Rick', 10080, false);

-- Create sms_logs table
CREATE TABLE public.sms_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.sessions(id),
  phone_number TEXT NOT NULL,
  trigger_name TEXT NOT NULL,
  message_sent TEXT NOT NULL,
  status TEXT DEFAULT 'sent',
  twilio_sid TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for sms_logs
CREATE POLICY "Logs viewable by service role" ON public.sms_logs
  FOR SELECT USING (auth.role() = 'service_role');

CREATE POLICY "Logs insertable by service role" ON public.sms_logs
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Create sms_scheduled table
CREATE TABLE public.sms_scheduled (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.sessions(id),
  trigger_name TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.sms_scheduled ENABLE ROW LEVEL SECURITY;

-- RLS policies for sms_scheduled
CREATE POLICY "Scheduled viewable by service role" ON public.sms_scheduled
  FOR SELECT USING (auth.role() = 'service_role');

CREATE POLICY "Scheduled insertable by service role" ON public.sms_scheduled
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Scheduled updatable by service role" ON public.sms_scheduled
  FOR UPDATE USING (auth.role() = 'service_role');

-- Create index for efficient scheduled message processing
CREATE INDEX idx_sms_scheduled_pending ON public.sms_scheduled (scheduled_for, status) WHERE status = 'pending';