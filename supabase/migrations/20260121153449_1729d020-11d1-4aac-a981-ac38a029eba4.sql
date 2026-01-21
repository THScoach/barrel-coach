-- Update the source_type constraint to include 'noa' for Brilliant Labs Halo voice notes
ALTER TABLE public.knowledge_documents 
DROP CONSTRAINT IF EXISTS knowledge_documents_source_type_check;

ALTER TABLE public.knowledge_documents 
ADD CONSTRAINT knowledge_documents_source_type_check 
CHECK (source_type IN ('pdf', 'doc', 'url', 'noa'));

-- Add category column for better organization
ALTER TABLE public.knowledge_documents 
ADD COLUMN IF NOT EXISTS category TEXT;

-- Add metadata column for Noa-specific data (timestamp, location, etc.)
ALTER TABLE public.knowledge_documents 
ADD COLUMN IF NOT EXISTS noa_metadata JSONB;