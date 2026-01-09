-- Create messages table for SMS conversations
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  phone_number VARCHAR(20) NOT NULL,
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  body TEXT NOT NULL,
  twilio_sid VARCHAR(50),
  status VARCHAR(20) DEFAULT 'sent',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient lookups
CREATE INDEX idx_messages_phone_number ON public.messages(phone_number);
CREATE INDEX idx_messages_session_id ON public.messages(session_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (for edge functions)
CREATE POLICY "Messages insertable by service role"
ON public.messages
FOR INSERT
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Messages viewable by service role"
ON public.messages
FOR SELECT
USING (auth.role() = 'service_role');

CREATE POLICY "Messages updatable by service role"
ON public.messages
FOR UPDATE
USING (auth.role() = 'service_role');

-- Add phone_number column to sessions table for SMS
ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS player_phone VARCHAR(20);