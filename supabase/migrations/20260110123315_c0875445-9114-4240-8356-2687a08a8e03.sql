-- Add RLS policies for videos storage bucket to allow admin uploads
CREATE POLICY "Admins can upload videos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'videos' 
  AND public.is_admin()
);

CREATE POLICY "Admins can update videos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'videos' 
  AND public.is_admin()
);

CREATE POLICY "Admins can delete videos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'videos' 
  AND public.is_admin()
);

CREATE POLICY "Anyone can view published videos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'videos');