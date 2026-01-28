-- Create conversations table for Coach Rick AI conversation logging
CREATE TABLE IF NOT EXISTS public.coach_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('inbound', 'outbound')),
  message_content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by TEXT DEFAULT 'coach_api'
);

-- Create index for fast lookups by player and phone
CREATE INDEX idx_coach_conversations_player_id ON public.coach_conversations(player_id);
CREATE INDEX idx_coach_conversations_phone ON public.coach_conversations(phone);
CREATE INDEX idx_coach_conversations_created_at ON public.coach_conversations(created_at DESC);

-- Enable RLS
ALTER TABLE public.coach_conversations ENABLE ROW LEVEL SECURITY;

-- Service role full access for edge functions
CREATE POLICY "Service role full access to coach_conversations"
  ON public.coach_conversations
  FOR ALL
  USING (auth.role() = 'service_role');

-- Admins can view all conversations
CREATE POLICY "Admins can view coach_conversations"
  ON public.coach_conversations
  FOR SELECT
  USING (is_admin());

-- Create audit log table for coach API writes
CREATE TABLE IF NOT EXISTS public.coach_api_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  player_id UUID,
  phone TEXT,
  request_body JSONB,
  response_status INTEGER,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for audit lookups
CREATE INDEX idx_coach_api_audit_created_at ON public.coach_api_audit_log(created_at DESC);

-- Enable RLS
ALTER TABLE public.coach_api_audit_log ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role full access to coach_api_audit_log"
  ON public.coach_api_audit_log
  FOR ALL
  USING (auth.role() = 'service_role');

-- Admins can view audit log
CREATE POLICY "Admins can view coach_api_audit_log"
  ON public.coach_api_audit_log
  FOR SELECT
  USING (is_admin());

-- Add last_contact_date and tags to players if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'players' 
                 AND column_name = 'last_contact_date') THEN
    ALTER TABLE public.players ADD COLUMN last_contact_date TIMESTAMP WITH TIME ZONE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'players' 
                 AND column_name = 'tags') THEN
    ALTER TABLE public.players ADD COLUMN tags TEXT[] DEFAULT '{}';
  END IF;
END $$;