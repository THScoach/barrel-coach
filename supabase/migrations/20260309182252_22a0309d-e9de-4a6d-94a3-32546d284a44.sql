
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS dk_user_uuid TEXT;

CREATE TABLE IF NOT EXISTS public.dk_token_cache (
  id INT PRIMARY KEY DEFAULT 1,
  access_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sensor_sessions ADD COLUMN IF NOT EXISTS dk_session_uuid TEXT UNIQUE;

-- RLS for dk_token_cache: service_role only
ALTER TABLE public.dk_token_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on dk_token_cache"
  ON public.dk_token_cache FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
