-- Add account management columns to players table

ALTER TABLE public.players ADD COLUMN IF NOT EXISTS
  account_status TEXT DEFAULT 'data_only' 
  CHECK (account_status IN ('data_only', 'active', 'beta', 'inactive'));

ALTER TABLE public.players ADD COLUMN IF NOT EXISTS
  account_type TEXT DEFAULT 'free'
  CHECK (account_type IN ('free', 'single', 'complete', 'inner_circle', 'beta'));

ALTER TABLE public.players ADD COLUMN IF NOT EXISTS
  is_beta_tester BOOLEAN DEFAULT false;

ALTER TABLE public.players ADD COLUMN IF NOT EXISTS
  beta_expires_at TIMESTAMPTZ;

ALTER TABLE public.players ADD COLUMN IF NOT EXISTS
  beta_notes TEXT;

ALTER TABLE public.players ADD COLUMN IF NOT EXISTS
  activated_at TIMESTAMPTZ;

ALTER TABLE public.players ADD COLUMN IF NOT EXISTS
  can_login BOOLEAN DEFAULT false;

ALTER TABLE public.players ADD COLUMN IF NOT EXISTS
  stripe_customer_id TEXT;

-- Add indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_players_account_status ON public.players(account_status);
CREATE INDEX IF NOT EXISTS idx_players_beta ON public.players(is_beta_tester) WHERE is_beta_tester = true;