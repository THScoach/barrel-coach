
-- Add kommodo_member_id to players table
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS kommodo_member_id TEXT;
CREATE INDEX IF NOT EXISTS idx_players_kommodo_member_id ON public.players (kommodo_member_id) WHERE kommodo_member_id IS NOT NULL;

-- Create player_kommodo_recordings table
CREATE TABLE public.player_kommodo_recordings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE NOT NULL,
  kommodo_recording_id TEXT NOT NULL,
  title TEXT,
  description TEXT,
  duration_seconds INTEGER,
  thumbnail_url TEXT,
  video_url TEXT,
  page_url TEXT,
  kommodo_member_id TEXT,
  kommodo_member_name TEXT,
  source TEXT NOT NULL DEFAULT 'kommodo',
  link_method TEXT DEFAULT 'manual', -- 'auto_member', 'auto_name', 'manual'
  recording_created_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(kommodo_recording_id)
);

CREATE INDEX idx_pkr_player_id ON public.player_kommodo_recordings (player_id);
CREATE INDEX idx_pkr_kommodo_recording_id ON public.player_kommodo_recordings (kommodo_recording_id);
CREATE INDEX idx_pkr_kommodo_member_id ON public.player_kommodo_recordings (kommodo_member_id) WHERE kommodo_member_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.player_kommodo_recordings ENABLE ROW LEVEL SECURITY;

-- Service role has full access (edge functions do all writes)
CREATE POLICY "Service role full access on player_kommodo_recordings"
  ON public.player_kommodo_recordings FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Admins can read all
CREATE POLICY "Admins can read player_kommodo_recordings"
  ON public.player_kommodo_recordings FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Players can read their own linked recordings
CREATE POLICY "Players can read own kommodo recordings"
  ON public.player_kommodo_recordings FOR SELECT
  TO authenticated
  USING (
    player_id IN (
      SELECT p.id FROM public.players p WHERE p.email = (auth.jwt() ->> 'email')
    )
  );

-- Kommodo sync log table
CREATE TABLE public.kommodo_sync_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running', -- 'running', 'completed', 'failed'
  recordings_found INTEGER DEFAULT 0,
  recordings_linked INTEGER DEFAULT 0,
  recordings_unlinked INTEGER DEFAULT 0,
  error TEXT,
  triggered_by TEXT DEFAULT 'manual'
);

ALTER TABLE public.kommodo_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on kommodo_sync_log"
  ON public.kommodo_sync_log FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can read kommodo_sync_log"
  ON public.kommodo_sync_log FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Trigger for updated_at on player_kommodo_recordings
CREATE TRIGGER update_player_kommodo_recordings_updated_at
  BEFORE UPDATE ON public.player_kommodo_recordings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
