-- Create ghost_sessions table for orphaned DK data
CREATE TABLE public.ghost_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  swings_data JSONB NOT NULL,
  swing_count INTEGER NOT NULL DEFAULT 0,
  avg_bat_speed DECIMAL(5,1),
  max_bat_speed DECIMAL(5,1),
  detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  recovered_at TIMESTAMP WITH TIME ZONE,
  environment VARCHAR(50),
  estimated_pitch_speed INTEGER,
  session_id UUID REFERENCES public.sensor_sessions(id),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'recovered', 'dismissed')),
  notification_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ghost_sessions ENABLE ROW LEVEL SECURITY;

-- Players can view their own ghost sessions (match by email)
CREATE POLICY "Players can view own ghost sessions"
  ON public.ghost_sessions FOR SELECT
  USING (
    player_id IN (
      SELECT id FROM public.players WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
    OR public.is_admin()
  );

-- Players can update their own ghost sessions (for recovery)
CREATE POLICY "Players can update own ghost sessions"
  ON public.ghost_sessions FOR UPDATE
  USING (
    player_id IN (
      SELECT id FROM public.players WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
    OR public.is_admin()
  );

-- Admins can manage all ghost sessions
CREATE POLICY "Admins can manage ghost sessions"
  ON public.ghost_sessions FOR ALL
  USING (public.is_admin());

-- Service role can insert ghost sessions (handled by edge functions)
CREATE POLICY "Service role inserts ghost sessions"
  ON public.ghost_sessions FOR INSERT
  WITH CHECK (true);

-- Create index for quick lookups
CREATE INDEX idx_ghost_sessions_player_pending ON public.ghost_sessions(player_id, status) WHERE status = 'pending';

-- Add has_ghost_session flag to players for quick badge display
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS has_ghost_session BOOLEAN DEFAULT FALSE;

-- Create trigger to update has_ghost_session flag
CREATE OR REPLACE FUNCTION public.update_player_ghost_session_flag()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    UPDATE public.players SET has_ghost_session = TRUE WHERE id = NEW.player_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status != 'pending' THEN
    UPDATE public.players 
    SET has_ghost_session = EXISTS (
      SELECT 1 FROM public.ghost_sessions 
      WHERE player_id = NEW.player_id AND status = 'pending' AND id != NEW.id
    )
    WHERE id = NEW.player_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_update_ghost_session_flag
AFTER INSERT OR UPDATE ON public.ghost_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_player_ghost_session_flag();