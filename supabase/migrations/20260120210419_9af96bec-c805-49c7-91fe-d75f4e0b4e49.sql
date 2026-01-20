-- ============================================
-- SYNC LOGS TABLE FOR REBOOT POLLING
-- ============================================

-- Create sync_logs table for monitoring automated syncs
CREATE TABLE IF NOT EXISTS public.sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT NOT NULL,
  players_checked INTEGER DEFAULT 0,
  sessions_processed INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,
  duration_ms INTEGER DEFAULT 0,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_sync_logs_created ON sync_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_logs_type ON sync_logs(sync_type);

-- Enable RLS
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view sync logs
CREATE POLICY "Admins can view sync logs"
  ON public.sync_logs
  FOR SELECT
  USING (public.is_admin());

-- Service role can insert (for edge functions)
CREATE POLICY "Service role can insert sync logs"
  ON public.sync_logs
  FOR INSERT
  WITH CHECK (true);

-- Add comment for documentation
COMMENT ON TABLE public.sync_logs IS 'Logs for automated Reboot Motion sync jobs';
COMMENT ON COLUMN public.sync_logs.sync_type IS 'Type of sync: reboot_polling, manual, etc.';
COMMENT ON COLUMN public.sync_logs.details IS 'JSON containing per-player results and errors';