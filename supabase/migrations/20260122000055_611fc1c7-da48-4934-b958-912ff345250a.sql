-- Add DELETE policy for academy_videos bucket for admins
CREATE POLICY "Admins can delete academy videos storage"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'academy_videos' 
  AND public.is_admin()
);

-- Also add UPDATE policy for admins on academy_videos
CREATE POLICY "Admins can update academy videos storage"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'academy_videos' 
  AND public.is_admin()
)
WITH CHECK (
  bucket_id = 'academy_videos' 
  AND public.is_admin()
);