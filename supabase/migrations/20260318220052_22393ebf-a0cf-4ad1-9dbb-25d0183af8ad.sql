
-- Create player_documents table
CREATE TABLE public.player_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid REFERENCES public.players(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  document_type text NOT NULL DEFAULT 'note',
  content_text text,
  file_url text,
  file_name text,
  file_type text,
  file_size_bytes integer,
  ai_extracted_text text,
  ai_summary text,
  tags text[] DEFAULT '{}',
  source text DEFAULT 'manual_upload',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX idx_player_documents_player_id ON public.player_documents(player_id);
CREATE INDEX idx_player_documents_type ON public.player_documents(document_type);

-- RLS
ALTER TABLE public.player_documents ENABLE ROW LEVEL SECURITY;

-- Admin and service_role full access
CREATE POLICY "Admin full access" ON public.player_documents
  FOR ALL USING (public.is_admin());

CREATE POLICY "Service role full access" ON public.player_documents
  FOR ALL USING (true) WITH CHECK (true);

-- Updated_at trigger
CREATE TRIGGER update_player_documents_updated_at
  BEFORE UPDATE ON public.player_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Storage bucket for player intel files
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('player-intel', 'player-intel', false, 26214400);

-- Storage RLS policies
CREATE POLICY "Admin can upload player intel" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'player-intel' AND public.is_admin());

CREATE POLICY "Admin can read player intel" ON storage.objects
  FOR SELECT USING (bucket_id = 'player-intel' AND public.is_admin());

CREATE POLICY "Admin can delete player intel" ON storage.objects
  FOR DELETE USING (bucket_id = 'player-intel' AND public.is_admin());

CREATE POLICY "Service role player intel" ON storage.objects
  FOR ALL USING (bucket_id = 'player-intel') WITH CHECK (bucket_id = 'player-intel');
