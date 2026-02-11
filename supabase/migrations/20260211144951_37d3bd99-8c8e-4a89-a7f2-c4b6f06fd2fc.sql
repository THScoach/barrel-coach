
-- 1. Increase movement_id length for Reboot imports
ALTER TABLE swing_analysis 
ALTER COLUMN movement_id TYPE varchar(100);

-- 2. Make player_id nullable for imports without user accounts
ALTER TABLE swing_analysis 
ALTER COLUMN player_id DROP NOT NULL;

-- 3. Add index for faster Reboot queries
CREATE INDEX IF NOT EXISTS idx_swing_analysis_reboot 
ON swing_analysis ((data_quality_flags @> ARRAY['reboot_motion_capture']));
