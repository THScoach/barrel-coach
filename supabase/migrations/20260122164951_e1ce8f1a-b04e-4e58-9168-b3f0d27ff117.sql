-- Remove GHL-related columns from database
ALTER TABLE players DROP COLUMN IF EXISTS ghl_contact_id;
ALTER TABLE player_profiles DROP COLUMN IF EXISTS ghl_contact_id;

-- Add opt-in fields if they don't exist (sms_opt_in may already exist based on code)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'sms_opt_in') THEN
    ALTER TABLE players ADD COLUMN sms_opt_in BOOLEAN DEFAULT TRUE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'email_opt_in') THEN
    ALTER TABLE players ADD COLUMN email_opt_in BOOLEAN DEFAULT TRUE;
  END IF;
END $$;

-- Add comments to document opt-in columns
COMMENT ON COLUMN players.sms_opt_in IS 'Player has opted in to receive SMS messages. Managed via STOP/START keywords.';
COMMENT ON COLUMN players.email_opt_in IS 'Player has opted in to receive email messages.';