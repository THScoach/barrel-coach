
-- Add 'scored' to the reboot_sessions status check constraint
ALTER TABLE reboot_sessions DROP CONSTRAINT reboot_sessions_status_check;
ALTER TABLE reboot_sessions ADD CONSTRAINT reboot_sessions_status_check 
  CHECK (status = ANY (ARRAY['pending', 'processing', 'completed', 'error', 'uploaded', 'ready_for_processing', 'scored']));

-- Fix existing data
UPDATE player_sessions 
SET reboot_session_id = 'manual-b8cd2971'
WHERE id = '2f2d9525-ac4a-453f-9d8f-79fd2d0ebf67';

DELETE FROM player_sessions 
WHERE player_id = 'fbce863e-a00d-49cb-8e54-f996d072a101'
  AND id != '2f2d9525-ac4a-453f-9d8f-79fd2d0ebf67'
  AND reboot_session_id IS NULL
  AND created_at >= '2026-03-11';

UPDATE reboot_sessions 
SET status = 'scored', processed_at = NOW()
WHERE id = '2fb837da-03a1-4898-8ef3-020a3c3548fb';
