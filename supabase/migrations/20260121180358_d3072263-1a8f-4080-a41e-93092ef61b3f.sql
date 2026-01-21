-- Create the academy_videos storage bucket for drill/vault video uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'academy_videos', 
  'academy_videos', 
  true,
  524288000, -- 500MB limit
  ARRAY['video/mp4', 'video/quicktime', 'video/webm']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload videos
CREATE POLICY "Authenticated users can upload academy videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'academy_videos');

-- Allow public read access for playback
CREATE POLICY "Public read access for academy videos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'academy_videos');

-- Allow admins to delete videos
CREATE POLICY "Admins can delete academy videos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'academy_videos' AND public.is_admin());