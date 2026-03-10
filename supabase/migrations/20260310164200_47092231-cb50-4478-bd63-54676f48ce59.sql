-- Create storage bucket for reboot file uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('reboot-uploads', 'reboot-uploads', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload reboot files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'reboot-uploads');

-- RLS: Allow authenticated users to read their uploads
CREATE POLICY "Authenticated users can read reboot files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'reboot-uploads');

-- RLS: Allow service role full access (via edge functions)
CREATE POLICY "Service role full access to reboot uploads"
ON storage.objects FOR ALL TO service_role
USING (bucket_id = 'reboot-uploads')
WITH CHECK (bucket_id = 'reboot-uploads');