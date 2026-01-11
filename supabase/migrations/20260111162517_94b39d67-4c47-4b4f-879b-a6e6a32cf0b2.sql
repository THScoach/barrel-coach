-- Make swing-videos bucket private (was incorrectly set to public)
UPDATE storage.buckets 
SET public = false 
WHERE id = 'swing-videos';

-- Drop any overly permissive storage policies that might exist
DROP POLICY IF EXISTS "Anyone can upload swing videos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view swing videos" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for swing-videos" ON storage.objects;