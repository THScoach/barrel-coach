-- Add health_energy_avg column to player_stack_data
ALTER TABLE public.player_stack_data
ADD COLUMN IF NOT EXISTS health_energy_avg numeric;