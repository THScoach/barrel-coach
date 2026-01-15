-- ============================================
-- REBOOT VIDEO UPLOAD AUTOMATION
-- Migration to add columns for video upload pipeline
-- ============================================

-- Add reboot_player_id to players table (different from reboot_athlete_id which is their internal ID)
-- This stores the org_player_id we use when creating sessions
ALTER TABLE players ADD COLUMN IF NOT EXISTS reboot_player_id VARCHAR(100);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_players_reboot_player_id ON players(reboot_player_id);

-- Add tracking fields to reboot_uploads table for video upload pipeline
ALTER TABLE reboot_uploads ADD COLUMN IF NOT EXISTS upload_source VARCHAR(50);
-- Values: 'onform', 'hittrax', 'direct_upload', 'api'

ALTER TABLE reboot_uploads ADD COLUMN IF NOT EXISTS reboot_session_id VARCHAR(100);

ALTER TABLE reboot_uploads ADD COLUMN IF NOT EXISTS processing_status VARCHAR(20) DEFAULT 'pending';
-- Values: 'pending', 'uploading', 'processing', 'complete', 'failed'

ALTER TABLE reboot_uploads ADD COLUMN IF NOT EXISTS frame_rate INTEGER;

ALTER TABLE reboot_uploads ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE reboot_uploads ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE reboot_uploads ADD COLUMN IF NOT EXISTS error_message TEXT;

ALTER TABLE reboot_uploads ADD COLUMN IF NOT EXISTS video_filename VARCHAR(255);

ALTER TABLE reboot_uploads ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Create indexes for polling queries
CREATE INDEX IF NOT EXISTS idx_reboot_uploads_processing_status ON reboot_uploads(processing_status);
CREATE INDEX IF NOT EXISTS idx_reboot_uploads_reboot_session_id ON reboot_uploads(reboot_session_id);

-- Add comment explaining the table's expanded purpose
COMMENT ON TABLE reboot_uploads IS 'Stores both manual CSV uploads and automated video upload tracking for Reboot Motion integration';

-- Add comments on new columns
COMMENT ON COLUMN reboot_uploads.upload_source IS 'Source of the upload: onform, hittrax, direct_upload, api';
COMMENT ON COLUMN reboot_uploads.reboot_session_id IS 'Reboot Motion session ID returned after video upload';
COMMENT ON COLUMN reboot_uploads.processing_status IS 'Status of Reboot processing: pending, uploading, processing, complete, failed';
COMMENT ON COLUMN reboot_uploads.frame_rate IS 'Video frame rate in fps (120, 240, 480, 600)';
COMMENT ON COLUMN reboot_uploads.uploaded_at IS 'Timestamp when video was uploaded to Reboot';
COMMENT ON COLUMN reboot_uploads.completed_at IS 'Timestamp when Reboot processing completed';
COMMENT ON COLUMN reboot_uploads.error_message IS 'Error message if upload or processing failed';
COMMENT ON COLUMN reboot_uploads.video_filename IS 'Original filename of uploaded video';
COMMENT ON COLUMN reboot_uploads.video_url IS 'URL to the video file in storage';