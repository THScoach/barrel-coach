-- Add publishing workflow columns to reboot_uploads
ALTER TABLE public.reboot_uploads 
ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS coach_notes_edited TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS eighth_grade_summary TEXT DEFAULT NULL;

-- Create index for unpublished reports queue
CREATE INDEX IF NOT EXISTS idx_reboot_uploads_unpublished 
ON public.reboot_uploads (session_date DESC) 
WHERE published_at IS NULL AND processing_status = 'complete';

-- Add comment for documentation
COMMENT ON COLUMN public.reboot_uploads.published_at IS 'When the report was approved and published to player app';
COMMENT ON COLUMN public.reboot_uploads.coach_notes_edited IS 'Coach-edited version of AI-generated summary';
COMMENT ON COLUMN public.reboot_uploads.eighth_grade_summary IS 'AI-generated 8th grade reading level summary';