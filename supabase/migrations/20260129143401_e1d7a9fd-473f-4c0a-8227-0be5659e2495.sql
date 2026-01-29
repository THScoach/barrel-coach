-- Add Diamond Kinetics sensor onboarding fields to players table
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS dk_email TEXT;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS has_sensor BOOLEAN DEFAULT false;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS sensor_connected BOOLEAN DEFAULT false;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS sensor_connected_at TIMESTAMPTZ;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS sensor_reminder_sent_at TIMESTAMPTZ;

-- Create index for efficient queries on sensor status
CREATE INDEX IF NOT EXISTS idx_players_sensor_status 
ON public.players (has_sensor, sensor_connected) 
WHERE has_sensor = true;

-- Add comment for documentation
COMMENT ON COLUMN public.players.dk_email IS 'Player Diamond Kinetics app email address';
COMMENT ON COLUMN public.players.has_sensor IS 'Whether player has purchased a DK sensor';
COMMENT ON COLUMN public.players.sensor_connected IS 'Whether player has been added to DK Catching Barrels group';
COMMENT ON COLUMN public.players.sensor_connected_at IS 'Timestamp when player was connected to DK group';
COMMENT ON COLUMN public.players.sensor_reminder_sent_at IS 'Last time a reminder was sent to connect sensor';