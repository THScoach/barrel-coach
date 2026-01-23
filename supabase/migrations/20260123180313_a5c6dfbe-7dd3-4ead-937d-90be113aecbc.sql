-- Add 'video' to the source_type constraint
ALTER TABLE public.content_items DROP CONSTRAINT IF EXISTS content_items_source_type_check;
ALTER TABLE public.content_items ADD CONSTRAINT content_items_source_type_check 
  CHECK (source_type IN ('voice', 'conversation', 'video', 'article'));