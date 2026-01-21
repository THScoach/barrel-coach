-- Add file_hash column for duplicate detection
ALTER TABLE public.knowledge_documents 
ADD COLUMN IF NOT EXISTS file_hash TEXT;

-- Create index for fast hash lookups
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_file_hash 
ON public.knowledge_documents(file_hash) 
WHERE file_hash IS NOT NULL;

-- Create index for URL deduplication
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_original_url 
ON public.knowledge_documents(original_url) 
WHERE original_url IS NOT NULL;

-- Function to check for duplicate file hash
CREATE OR REPLACE FUNCTION public.check_duplicate_document(p_file_hash TEXT)
RETURNS TABLE (
  id UUID,
  title TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT kd.id, kd.title, kd.created_at
  FROM public.knowledge_documents kd
  WHERE kd.file_hash = p_file_hash
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to check for duplicate URL
CREATE OR REPLACE FUNCTION public.check_duplicate_url(p_url TEXT)
RETURNS TABLE (
  id UUID,
  title TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT kd.id, kd.title, kd.created_at
  FROM public.knowledge_documents kd
  WHERE kd.original_url = p_url
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to find potential duplicates based on matching hashes
CREATE OR REPLACE FUNCTION public.find_duplicate_documents()
RETURNS TABLE (
  file_hash TEXT,
  duplicate_count BIGINT,
  document_ids UUID[],
  document_titles TEXT[],
  total_size BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    kd.file_hash,
    COUNT(*) AS duplicate_count,
    ARRAY_AGG(kd.id ORDER BY kd.created_at) AS document_ids,
    ARRAY_AGG(kd.title ORDER BY kd.created_at) AS document_titles,
    COALESCE(SUM(kd.file_size), 0) AS total_size
  FROM public.knowledge_documents kd
  WHERE kd.file_hash IS NOT NULL
  GROUP BY kd.file_hash
  HAVING COUNT(*) > 1
  ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;