-- Create unique partial index on reboot_session_id (ignoring nulls)
CREATE UNIQUE INDEX IF NOT EXISTS reference_sessions_reboot_session_id_unique 
ON public.reference_sessions (reboot_session_id) 
WHERE reboot_session_id IS NOT NULL;