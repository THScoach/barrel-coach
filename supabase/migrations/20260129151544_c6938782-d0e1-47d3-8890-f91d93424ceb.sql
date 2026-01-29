-- Global coaching rules that apply to all Coach Rick responses
CREATE TABLE IF NOT EXISTS public.coach_rick_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type TEXT NOT NULL CHECK (rule_type IN ('always', 'never', 'global')),
  rule_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT, -- phone number of admin who added it
  active BOOLEAN DEFAULT true
);

-- Enable RLS
ALTER TABLE public.coach_rick_rules ENABLE ROW LEVEL SECURITY;

-- Admin-only access (service role for edge functions)
CREATE POLICY "Service role can manage coach_rick_rules"
ON public.coach_rick_rules
FOR ALL
USING (true)
WITH CHECK (true);

-- Blocked phone numbers
CREATE TABLE IF NOT EXISTS public.blocked_numbers (
  phone TEXT PRIMARY KEY,
  blocked_at TIMESTAMPTZ DEFAULT NOW(),
  blocked_by TEXT,
  reason TEXT
);

-- Enable RLS
ALTER TABLE public.blocked_numbers ENABLE ROW LEVEL SECURITY;

-- Admin-only access
CREATE POLICY "Service role can manage blocked_numbers"
ON public.blocked_numbers
FOR ALL
USING (true)
WITH CHECK (true);

-- Add coaching_notes column to players if not exists
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS coaching_notes JSONB DEFAULT '[]';

-- Create index for faster rule lookups
CREATE INDEX IF NOT EXISTS idx_coach_rick_rules_active ON public.coach_rick_rules(active) WHERE active = true;