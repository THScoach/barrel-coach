-- Create parent/guardian linking table
CREATE TABLE public.parent_player_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  relationship VARCHAR(50) DEFAULT 'parent', -- parent, guardian, coach, etc.
  player_consented BOOLEAN NOT NULL DEFAULT false,
  consented_at TIMESTAMP WITH TIME ZONE,
  
  -- Notification preferences
  notify_session_complete BOOLEAN DEFAULT false,
  notify_weekly_report BOOLEAN DEFAULT false,
  notify_milestone BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Prevent duplicate links
  UNIQUE(parent_id, player_id)
);

-- Add comment
COMMENT ON TABLE public.parent_player_links IS 'Links parents/guardians to players they can view data for. Players must consent to linking.';

-- Enable RLS
ALTER TABLE public.parent_player_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Admins can do everything
CREATE POLICY "Admins can manage parent links"
ON public.parent_player_links
FOR ALL
USING (public.is_admin());

-- Service role for edge functions
CREATE POLICY "Service role can manage parent links"
ON public.parent_player_links
FOR ALL
USING (auth.role() = 'service_role');

-- Create trigger for updated_at
CREATE TRIGGER update_parent_player_links_updated_at
  BEFORE UPDATE ON public.parent_player_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add parent_type column to players table to mark parent contacts
ALTER TABLE public.players 
ADD COLUMN IF NOT EXISTS contact_type VARCHAR(50) DEFAULT 'player';

COMMENT ON COLUMN public.players.contact_type IS 'Type of contact: player, parent, guardian, staff, beta_tester';

-- Create index for faster lookups
CREATE INDEX idx_parent_player_links_parent ON public.parent_player_links(parent_id);
CREATE INDEX idx_parent_player_links_player ON public.parent_player_links(player_id);