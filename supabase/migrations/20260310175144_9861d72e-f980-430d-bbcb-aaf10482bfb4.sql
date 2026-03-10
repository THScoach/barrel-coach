-- Remove duplicate reboot_sessions, keeping only the oldest per (reboot_session_id, player_id)
DELETE FROM reboot_sessions
WHERE id NOT IN (
  SELECT DISTINCT ON (reboot_session_id, player_id) id
  FROM reboot_sessions
  ORDER BY reboot_session_id, player_id, created_at ASC
);

-- Add unique constraint to prevent future duplicates
ALTER TABLE reboot_sessions
ADD CONSTRAINT uq_reboot_session_player UNIQUE (reboot_session_id, player_id);