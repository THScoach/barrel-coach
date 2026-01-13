-- Add bat_mass_kg column to players table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'players' 
    AND column_name = 'bat_mass_kg'
  ) THEN
    ALTER TABLE public.players ADD COLUMN bat_mass_kg NUMERIC DEFAULT 0.88;
    COMMENT ON COLUMN public.players.bat_mass_kg IS 'Bat mass in kg for 4B calculations (default 0.88 = ~31oz)';
  END IF;
END $$;

-- Add primary issue fields to swing_4b_scores if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'swing_4b_scores' 
    AND column_name = 'primary_issue_title'
  ) THEN
    ALTER TABLE public.swing_4b_scores ADD COLUMN primary_issue_title TEXT;
    ALTER TABLE public.swing_4b_scores ADD COLUMN primary_issue_description TEXT;
    ALTER TABLE public.swing_4b_scores ADD COLUMN primary_issue_category TEXT;
  END IF;
END $$;