-- Create dk_accounts table to store linked Diamond Kinetics accounts
CREATE TABLE public.dk_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  dk_user_id TEXT NOT NULL,
  dk_email TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(player_id),
  UNIQUE(dk_user_id)
);

-- Enable RLS
ALTER TABLE public.dk_accounts ENABLE ROW LEVEL SECURITY;

-- Players can view their own DK account
CREATE POLICY "Players can view their own DK account"
ON public.dk_accounts
FOR SELECT
USING (
  player_id IN (
    SELECT id FROM public.players 
    WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
);

-- Players can insert their own DK account
CREATE POLICY "Players can insert their own DK account"
ON public.dk_accounts
FOR INSERT
WITH CHECK (
  player_id IN (
    SELECT id FROM public.players 
    WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
);

-- Players can update their own DK account
CREATE POLICY "Players can update their own DK account"
ON public.dk_accounts
FOR UPDATE
USING (
  player_id IN (
    SELECT id FROM public.players 
    WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
);

-- Players can delete their own DK account
CREATE POLICY "Players can delete their own DK account"
ON public.dk_accounts
FOR DELETE
USING (
  player_id IN (
    SELECT id FROM public.players 
    WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
);

-- Admins can manage all DK accounts
CREATE POLICY "Admins can manage all DK accounts"
ON public.dk_accounts
FOR ALL
USING (public.is_admin());

-- Create trigger for updated_at
CREATE TRIGGER update_dk_accounts_updated_at
BEFORE UPDATE ON public.dk_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster lookups
CREATE INDEX idx_dk_accounts_player_id ON public.dk_accounts(player_id);
CREATE INDEX idx_dk_accounts_dk_user_id ON public.dk_accounts(dk_user_id);