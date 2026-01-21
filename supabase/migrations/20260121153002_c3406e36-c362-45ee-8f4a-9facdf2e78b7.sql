-- Create storage bucket for coach knowledge
INSERT INTO storage.buckets (id, name, public)
VALUES ('coach_knowledge', 'coach_knowledge', false)
ON CONFLICT (id) DO NOTHING;

-- Create table to track knowledge documents
CREATE TABLE public.knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('pdf', 'doc', 'url')),
  storage_path TEXT,
  original_url TEXT,
  extracted_text TEXT,
  file_size INTEGER,
  mime_type VARCHAR(100),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'error')),
  error_message TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;

-- Admin-only access policies
CREATE POLICY "Admins can view all knowledge documents"
  ON public.knowledge_documents FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can insert knowledge documents"
  ON public.knowledge_documents FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update knowledge documents"
  ON public.knowledge_documents FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admins can delete knowledge documents"
  ON public.knowledge_documents FOR DELETE
  USING (public.is_admin());

-- Storage policies for coach_knowledge bucket
CREATE POLICY "Admins can upload to coach_knowledge"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'coach_knowledge' AND public.is_admin()
  );

CREATE POLICY "Admins can view coach_knowledge files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'coach_knowledge' AND public.is_admin()
  );

CREATE POLICY "Admins can delete from coach_knowledge"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'coach_knowledge' AND public.is_admin()
  );

-- Add updated_at trigger
CREATE TRIGGER update_knowledge_documents_updated_at
  BEFORE UPDATE ON public.knowledge_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();