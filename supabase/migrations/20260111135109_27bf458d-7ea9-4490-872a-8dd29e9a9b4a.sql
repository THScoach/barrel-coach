-- Add swings_max_allowed column to sessions table
-- swings_required stays as minimum required (for backwards compatibility)
-- swings_max_allowed is the maximum allowed per session (default 15)

ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS swings_max_allowed INTEGER DEFAULT 15;

-- Add a comment for clarity
COMMENT ON COLUMN public.sessions.swings_required IS 'Minimum number of swings required for analysis';
COMMENT ON COLUMN public.sessions.swings_max_allowed IS 'Maximum number of swings allowed per session';

-- Update existing rows to have swings_max_allowed = 15 if null
UPDATE public.sessions 
SET swings_max_allowed = 15 
WHERE swings_max_allowed IS NULL;