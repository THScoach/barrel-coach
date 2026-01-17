-- Add player_id to messages table for better player-centric conversations
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS player_id UUID REFERENCES public.players(id);

-- Add trigger_type to track what triggered the message
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS trigger_type VARCHAR(50);

-- Add ai_generated flag to know if Coach Rick AI wrote it
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN DEFAULT FALSE;

-- Create index for player conversations
CREATE INDEX IF NOT EXISTS idx_messages_player_id ON public.messages(player_id);
CREATE INDEX IF NOT EXISTS idx_messages_phone_created ON public.messages(phone_number, created_at DESC);

-- Add sms_opt_in to players if not exists
ALTER TABLE public.players
ADD COLUMN IF NOT EXISTS sms_opt_in BOOLEAN DEFAULT TRUE;

-- Create function to find player by phone number
CREATE OR REPLACE FUNCTION public.find_player_by_phone(phone_input TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  player_uuid UUID;
  normalized_phone TEXT;
BEGIN
  -- Normalize the phone number (strip non-digits)
  normalized_phone := regexp_replace(phone_input, '[^0-9]', '', 'g');
  
  -- Try to find player with exact match first
  SELECT id INTO player_uuid
  FROM public.players
  WHERE regexp_replace(phone, '[^0-9]', '', 'g') = normalized_phone
  LIMIT 1;
  
  IF player_uuid IS NOT NULL THEN
    RETURN player_uuid;
  END IF;
  
  -- Try without country code (last 10 digits)
  IF length(normalized_phone) > 10 THEN
    normalized_phone := right(normalized_phone, 10);
  END IF;
  
  SELECT id INTO player_uuid
  FROM public.players
  WHERE right(regexp_replace(phone, '[^0-9]', '', 'g'), 10) = normalized_phone
  LIMIT 1;
  
  RETURN player_uuid;
END;
$$;