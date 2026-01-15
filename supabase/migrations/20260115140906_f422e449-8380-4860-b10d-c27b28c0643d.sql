-- Make swing-videos bucket public for read access
UPDATE storage.buckets 
SET public = true 
WHERE id = 'swing-videos';

-- Create RLS policies for swing-videos bucket
DROP POLICY IF EXISTS "Authenticated users can upload swing videos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view swing videos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete swing videos" ON storage.objects;

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload swing videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'swing-videos');

-- Allow public read access
CREATE POLICY "Anyone can view swing videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'swing-videos');

-- Allow authenticated users to update their uploads
CREATE POLICY "Authenticated users can update swing videos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'swing-videos');

-- Allow authenticated users to delete
CREATE POLICY "Authenticated users can delete swing videos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'swing-videos');