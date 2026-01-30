-- Create training_archive table for ML dataset collection
CREATE TABLE public.training_archive (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- References
  player_id UUID REFERENCES public.players(id),
  session_id UUID,
  swing_id UUID,
  
  -- Raw video
  raw_video_url TEXT,
  raw_video_storage_path TEXT,
  video_duration_seconds NUMERIC,
  video_resolution TEXT,
  
  -- Reboot 3D skeleton output (full skeleton data)
  reboot_3d_skeleton JSONB,
  skeleton_frame_count INTEGER,
  skeleton_fps NUMERIC,
  
  -- All kinematic data
  kinematic_data JSONB,
  bat_speed_max NUMERIC,
  bat_speed_avg NUMERIC,
  hand_speed_max NUMERIC,
  attack_angle NUMERIC,
  time_to_contact_ms NUMERIC,
  rotational_acceleration NUMERIC,
  
  -- 4B Scores
  four_b_brain NUMERIC,
  four_b_body NUMERIC,
  four_b_bat NUMERIC,
  four_b_ball NUMERIC,
  four_b_composite NUMERIC,
  four_b_grades JSONB,
  
  -- Motor Profile
  motor_profile TEXT,
  motor_profile_confidence NUMERIC,
  
  -- Energy flow / leak data
  ground_flow NUMERIC,
  core_flow NUMERIC,
  upper_flow NUMERIC,
  leak_type TEXT,
  leak_data JSONB,
  
  -- Additional metadata
  source_system TEXT, -- 'sensor', 'video', 'hittrax', etc.
  data_quality TEXT, -- 'excellent', 'good', 'fair', 'limited'
  environment TEXT, -- 'cage', 'field', 'game', etc.
  pitch_speed NUMERIC,
  pitch_type TEXT,
  contact_result TEXT,
  
  -- ML training metadata
  is_labeled BOOLEAN DEFAULT false,
  labels JSONB,
  exclude_from_training BOOLEAN DEFAULT false,
  exclusion_reason TEXT,
  
  -- Full raw data dump for anything we might need later
  raw_sensor_payload JSONB,
  raw_analysis_output JSONB,
  metadata JSONB
);

-- Create indexes for efficient querying
CREATE INDEX idx_training_archive_player_id ON public.training_archive(player_id);
CREATE INDEX idx_training_archive_created_at ON public.training_archive(created_at DESC);
CREATE INDEX idx_training_archive_motor_profile ON public.training_archive(motor_profile);
CREATE INDEX idx_training_archive_source ON public.training_archive(source_system);
CREATE INDEX idx_training_archive_quality ON public.training_archive(data_quality);
CREATE INDEX idx_training_archive_labeled ON public.training_archive(is_labeled) WHERE is_labeled = true;

-- Enable RLS
ALTER TABLE public.training_archive ENABLE ROW LEVEL SECURITY;

-- RLS policies - only admins can access training data
CREATE POLICY "Admins can view training archive"
ON public.training_archive
FOR SELECT
USING (public.is_admin());

CREATE POLICY "Admins can insert training archive"
ON public.training_archive
FOR INSERT
WITH CHECK (public.is_admin());

CREATE POLICY "Service role can insert training archive"
ON public.training_archive
FOR INSERT
WITH CHECK (true);

-- Add comment for documentation
COMMENT ON TABLE public.training_archive IS 'Permanent archive of all swing data for ML training. Includes raw video, 3D skeleton, kinematics, 4B scores, and motor profiles.';