-- Add injury_history JSONB column to players for Swing Rehab diagnostic
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS injury_history jsonb DEFAULT '[]'::jsonb;

-- Add coach_barrels_state to hitting_4b_krs_sessions for storing diagnostic conversation state
ALTER TABLE public.hitting_4b_krs_sessions ADD COLUMN IF NOT EXISTS coach_barrels_classification jsonb DEFAULT NULL;
ALTER TABLE public.hitting_4b_krs_sessions ADD COLUMN IF NOT EXISTS coach_barrels_prescription jsonb DEFAULT NULL;
ALTER TABLE public.hitting_4b_krs_sessions ADD COLUMN IF NOT EXISTS coach_barrels_voice_sample text DEFAULT NULL;

COMMENT ON COLUMN public.players.injury_history IS 'Array of {injury, status, notes} objects for Swing Rehab capacity vs recruitment classification';
COMMENT ON COLUMN public.hitting_4b_krs_sessions.coach_barrels_classification IS 'Coach Barrels capacity vs recruitment classification per flag';
COMMENT ON COLUMN public.hitting_4b_krs_sessions.coach_barrels_prescription IS 'Coach Barrels generated prescription based on flag stack + classification';
COMMENT ON COLUMN public.hitting_4b_krs_sessions.coach_barrels_voice_sample IS 'Coach Barrels voice sample text for the player';