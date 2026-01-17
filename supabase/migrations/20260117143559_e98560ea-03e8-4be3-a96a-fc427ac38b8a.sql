-- Add 2D video analysis tracking columns to reboot_uploads
ALTER TABLE reboot_uploads ADD COLUMN IF NOT EXISTS analysis_type VARCHAR(20) DEFAULT 'reboot_3d';
-- Values: '2d_video', 'reboot_3d', 'combined'

ALTER TABLE reboot_uploads ADD COLUMN IF NOT EXISTS pending_reboot BOOLEAN DEFAULT false;
ALTER TABLE reboot_uploads ADD COLUMN IF NOT EXISTS original_video_url TEXT;
ALTER TABLE reboot_uploads ADD COLUMN IF NOT EXISTS video_2d_analysis JSONB;

-- Add camera_angle and video_quality for 2D analysis metadata
ALTER TABLE reboot_uploads ADD COLUMN IF NOT EXISTS camera_angle VARCHAR(30);
ALTER TABLE reboot_uploads ADD COLUMN IF NOT EXISTS video_quality VARCHAR(20);
ALTER TABLE reboot_uploads ADD COLUMN IF NOT EXISTS leak_detected VARCHAR(50);
ALTER TABLE reboot_uploads ADD COLUMN IF NOT EXISTS leak_evidence TEXT;
ALTER TABLE reboot_uploads ADD COLUMN IF NOT EXISTS motor_profile VARCHAR(30);
ALTER TABLE reboot_uploads ADD COLUMN IF NOT EXISTS motor_profile_evidence TEXT;
ALTER TABLE reboot_uploads ADD COLUMN IF NOT EXISTS priority_drill TEXT;
ALTER TABLE reboot_uploads ADD COLUMN IF NOT EXISTS analysis_confidence DECIMAL(3,2);

-- Create index for pending queue
CREATE INDEX IF NOT EXISTS idx_reboot_uploads_pending ON reboot_uploads(pending_reboot, analysis_type) WHERE pending_reboot = true;

-- Create view for admin queue
CREATE OR REPLACE VIEW pending_reboot_queue AS
SELECT 
  ru.id,
  ru.player_id,
  p.name as player_name,
  p.age as player_age,
  p.level as player_level,
  ru.created_at as uploaded_at,
  ru.composite_score as estimated_score,
  ru.grade as estimated_grade,
  ru.original_video_url,
  ru.video_2d_analysis,
  ru.leak_detected,
  ru.motor_profile,
  ru.analysis_confidence
FROM reboot_uploads ru
JOIN players p ON ru.player_id = p.id
WHERE ru.pending_reboot = true
  AND ru.analysis_type = '2d_video'
ORDER BY ru.created_at ASC;