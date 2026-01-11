-- Step 1: Add players_id column to player_profiles with FK reference
ALTER TABLE public.player_profiles 
ADD COLUMN players_id uuid NULL REFERENCES public.players(id) ON DELETE SET NULL;

-- Add index for efficient lookups
CREATE INDEX idx_player_profiles_players_id ON public.player_profiles(players_id);