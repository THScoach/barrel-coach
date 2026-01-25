-- Update storage bucket file size limits to 2GB for video uploads
UPDATE storage.buckets 
SET file_size_limit = 2147483648 -- 2GB
WHERE id IN ('videos', 'swing-videos', 'academy_videos', 'content-engine');