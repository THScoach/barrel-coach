-- Add columns for manual upload support
ALTER TABLE public.reboot_sessions 
  ADD COLUMN IF NOT EXISTS raw_csv_ik text,
  ADD COLUMN IF NOT EXISTS raw_csv_me text,
  ADD COLUMN IF NOT EXISTS parsed_metrics jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'sync';

-- Backfill existing rows as 'sync' source
UPDATE public.reboot_sessions SET source = 'sync' WHERE source IS NULL;