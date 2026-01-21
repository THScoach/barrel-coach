-- Add estimated_pitch_speed column to sensor_sessions
ALTER TABLE public.sensor_sessions 
ADD COLUMN IF NOT EXISTS estimated_pitch_speed INTEGER;

-- Add comment explaining the column
COMMENT ON COLUMN public.sensor_sessions.estimated_pitch_speed IS 'Estimated pitch speed in MPH from session setup context';