-- Create table to log GHL webhook interactions
CREATE TABLE public.ghl_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  session_id UUID REFERENCES sessions(id),
  player_id UUID REFERENCES players(id),
  payload JSONB NOT NULL,
  status TEXT DEFAULT 'received',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_ghl_webhook_logs_session ON public.ghl_webhook_logs(session_id);
CREATE INDEX idx_ghl_webhook_logs_event ON public.ghl_webhook_logs(event_type);
CREATE INDEX idx_ghl_webhook_logs_created ON public.ghl_webhook_logs(created_at DESC);

-- Enable RLS but allow service role full access
ALTER TABLE public.ghl_webhook_logs ENABLE ROW LEVEL SECURITY;

-- Policy for admin access only
CREATE POLICY "Admins can view webhook logs"
ON public.ghl_webhook_logs
FOR SELECT
USING (public.is_admin());

CREATE POLICY "Service role can manage webhook logs"
ON public.ghl_webhook_logs
FOR ALL
USING (true)
WITH CHECK (true);