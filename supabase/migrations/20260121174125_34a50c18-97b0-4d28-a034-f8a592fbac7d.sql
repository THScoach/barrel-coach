-- Create locker_room_messages table for AI-generated coach messages
CREATE TABLE public.locker_room_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  message_type VARCHAR(50) NOT NULL DEFAULT 'coaching',
  trigger_reason VARCHAR(100),
  content TEXT NOT NULL,
  summary TEXT,
  drill_links JSONB DEFAULT '[]',
  four_b_context JSONB,
  is_read BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  ai_model VARCHAR(50),
  session_id UUID REFERENCES public.sessions(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  read_at TIMESTAMP WITH TIME ZONE
);

-- Add indexes
CREATE INDEX idx_locker_room_messages_player_id ON public.locker_room_messages(player_id);
CREATE INDEX idx_locker_room_messages_unread ON public.locker_room_messages(player_id, is_read) WHERE NOT is_read;
CREATE INDEX idx_locker_room_messages_created_at ON public.locker_room_messages(created_at DESC);

-- Enable RLS
ALTER TABLE public.locker_room_messages ENABLE ROW LEVEL SECURITY;

-- Players can view their own messages (matched by email)
CREATE POLICY "Players can view their own locker room messages"
ON public.locker_room_messages
FOR SELECT
USING (
  player_id IN (
    SELECT p.id FROM public.players p 
    WHERE p.email = auth.jwt()->>'email'
  )
  OR public.is_admin()
);

-- Players can update read status of their messages
CREATE POLICY "Players can update read status of their messages"
ON public.locker_room_messages
FOR UPDATE
USING (
  player_id IN (
    SELECT p.id FROM public.players p 
    WHERE p.email = auth.jwt()->>'email'
  )
  OR public.is_admin()
);

-- Service role can insert messages
CREATE POLICY "Service role can insert locker room messages"
ON public.locker_room_messages
FOR INSERT
WITH CHECK (true);

-- Admins can manage all messages
CREATE POLICY "Admins can manage all locker room messages"
ON public.locker_room_messages
FOR ALL
USING (public.is_admin());

-- Add unread count to players
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS unread_locker_messages INTEGER DEFAULT 0;

-- Function to update unread count
CREATE OR REPLACE FUNCTION public.update_locker_message_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.players 
    SET unread_locker_messages = COALESCE(unread_locker_messages, 0) + 1
    WHERE id = NEW.player_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.is_read = false AND NEW.is_read = true THEN
    UPDATE public.players 
    SET unread_locker_messages = GREATEST(0, COALESCE(unread_locker_messages, 0) - 1)
    WHERE id = NEW.player_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger to maintain unread count
CREATE TRIGGER trigger_update_locker_message_count
AFTER INSERT OR UPDATE OF is_read ON public.locker_room_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_locker_message_count();

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.locker_room_messages;