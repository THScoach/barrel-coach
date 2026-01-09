-- Drop existing status check constraint
ALTER TABLE public.drill_videos DROP CONSTRAINT IF EXISTS drill_videos_status_check;

-- Add updated status check constraint with 'failed' status
ALTER TABLE public.drill_videos ADD CONSTRAINT drill_videos_status_check 
CHECK (status IN ('draft', 'processing', 'transcribing', 'analyzing', 'ready_for_review', 'published', 'failed'));