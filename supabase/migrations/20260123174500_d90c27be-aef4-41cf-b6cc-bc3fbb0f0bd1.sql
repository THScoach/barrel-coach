-- Create storage bucket for content engine uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'content-engine',
  'content-engine',
  false,
  52428800, -- 50MB limit
  ARRAY['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'video/webm', 'video/mp4', 'video/quicktime']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies for content-engine bucket
CREATE POLICY "Admins can upload to content-engine"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'content-engine' AND
  public.is_admin()
);

CREATE POLICY "Admins can view content-engine files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'content-engine' AND
  public.is_admin()
);

CREATE POLICY "Admins can delete content-engine files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'content-engine' AND
  public.is_admin()
);

CREATE POLICY "Service role can access content-engine"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'content-engine')
WITH CHECK (bucket_id = 'content-engine');