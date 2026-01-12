/**
 * VIDEO TYPE ARCHITECTURE
 * =======================
 * 
 * This application has TWO COMPLETELY SEPARATE video systems that must NEVER be mixed:
 * 
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ 1. DRILL CONTENT VIDEOS (drill_videos table)                                │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │ Purpose:    Instructional content, lessons, technique breakdowns            │
 * │ Duration:   Typically 1-10+ minutes                                         │
 * │ Frame rate: Standard 30 fps                                                 │
 * │ Features:   - Transcribed for searchability                                 │
 * │             - Used by "Ask Rick" AI chat                                    │
 * │             - Tagged by 4B category, problem addressed, motor profile       │
 * │             - Access levels: free, paid, inner_circle                       │
 * │ UI Access:  - Admin: /admin/videos (AdminVideos.tsx)                        │
 * │             - Player: /library (Library.tsx)                                │
 * │             - Recommendations: VideoRecommendations.tsx                     │
 * │ Upload:     upload-video, upload-to-gumlet edge functions                   │
 * │ Storage:    videos bucket → drills/ folder                                  │
 * └─────────────────────────────────────────────────────────────────────────────┘
 * 
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ 2. SWING ANALYZER CLIPS (video_swing_sessions + video_swings tables)        │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │ Purpose:    High-speed swing analysis for Reboot/SAM3/4B scoring            │
 * │ Duration:   0.8-1.5 seconds around contact                                  │
 * │ Frame rate: HIGH SPEED 120-240 fps required for accurate sequencing         │
 * │ Features:   - Tied to specific player_id                                    │
 * │             - Session-based (5-15 swings per session)                       │
 * │             - Analyzed for body→bat momentum sequence                       │
 * │             - Generates 4B scores and seasonal reports                      │
 * │             - NEVER transcribed or used by Ask Rick                         │
 * │ UI Access:  - Admin: VideoAnalyzerTab, VideoAnalyzerDetail                  │
 * │             - Player: Player data views                                     │
 * │ Upload:     VideoSwingUploadModal.tsx, import-onform-video                  │
 * │ Storage:    swing-videos bucket                                             │
 * └─────────────────────────────────────────────────────────────────────────────┘
 * 
 * DATABASE SCHEMA:
 * 
 * drill_videos (instructional content)
 * ├── id, title, description, video_url
 * ├── transcript, transcript_segments (for Ask Rick)
 * ├── four_b_category, problems_addressed, motor_profiles
 * ├── access_level (free/paid/inner_circle)
 * ├── video_type (drill/lesson/breakdown)
 * ├── gumlet_* fields for adaptive streaming
 * └── status (processing/transcribing/analyzing/ready_for_review/published)
 * 
 * video_swing_sessions (analyzer sessions)
 * ├── id, player_id (FK to players.id)
 * ├── session_date, source, context
 * ├── video_count, analyzed_count
 * └── status (pending/analyzing/complete/failed)
 * 
 * video_swings (individual swing clips)
 * ├── id, session_id (FK to video_swing_sessions.id)
 * ├── swing_index, video_storage_path, video_url
 * ├── frame_rate, duration_seconds
 * ├── sequence_analysis, sequence_score, sequence_errors
 * └── status (uploaded/processing/analyzed/failed)
 * 
 * CRITICAL RULES:
 * 1. NEVER insert swing analyzer clips into drill_videos
 * 2. NEVER query drill_videos for player swing analysis
 * 3. NEVER send video_swings to transcription pipeline
 * 4. NEVER show video_swings in the Library or VideoRecommendations
 * 5. NEVER show drill_videos in VideoAnalyzerTab or player swing views
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Types for drill content videos (instructional)
 */
export type DrillVideoType = 'drill' | 'lesson' | 'breakdown';
export type DrillAccessLevel = 'free' | 'paid' | 'inner_circle';
export type DrillVideoStatus = 
  | 'processing' 
  | 'transcribing' 
  | 'analyzing' 
  | 'ready_for_review' 
  | 'draft' 
  | 'published'
  | 'failed'
  | 'processing_failed';

export interface DrillVideo {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  transcript: string | null;
  transcript_segments: { start: number; end: number; text: string }[] | null;
  four_b_category: 'brain' | 'body' | 'bat' | 'ball' | null;
  drill_name: string | null;
  problems_addressed: string[] | null;
  motor_profiles: string[] | null;
  tags: string[] | null;
  access_level: DrillAccessLevel;
  duration_seconds: number | null;
  video_type: DrillVideoType;
  player_level: string[] | null;
  status: DrillVideoStatus;
  published_at: string | null;
  created_at: string;
  // Gumlet streaming fields
  gumlet_asset_id: string | null;
  gumlet_playback_url: string | null;
  gumlet_hls_url: string | null;
  gumlet_dash_url: string | null;
}

/**
 * Types for swing analyzer clips (player performance)
 */
export type SwingContext = 'practice' | 'game' | 'cage' | 'lesson' | 'other';
export type SwingSource = 'player_upload' | 'admin_upload' | 'coach_upload' | 'onform_import';
export type SwingSessionStatus = 'pending' | 'analyzing' | 'complete' | 'failed';
export type SwingClipStatus = 'uploaded' | 'processing' | 'analyzed' | 'failed';

export interface VideoSwingSession {
  id: string;
  player_id: string;
  session_date: string;
  source: SwingSource;
  context: SwingContext;
  status: SwingSessionStatus;
  video_count: number;
  analyzed_count: number;
  notes: string | null;
  // Aggregate scores (computed after analysis)
  sequence_score?: number;
  created_at: string;
  updated_at: string;
}

export interface VideoSwing {
  id: string;
  session_id: string;
  swing_index: number;
  video_storage_path: string;
  video_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  frame_rate: number | null;
  status: SwingClipStatus;
  // Analysis results
  sequence_analysis: Record<string, unknown> | null;
  sequence_score: number | null;
  sequence_errors: string[] | null;
  created_at: string;
}

// ============================================================================
// STORAGE PATHS
// ============================================================================

/**
 * Storage bucket and path constants to prevent cross-contamination
 */
export const VIDEO_STORAGE = {
  /** Bucket for instructional drill videos */
  DRILL_BUCKET: 'videos',
  /** Folder within drill bucket */
  DRILL_FOLDER: 'drills',
  
  /** Bucket for swing analyzer clips */
  SWING_BUCKET: 'swing-videos',
  
  /** Generate path for a drill video */
  getDrillPath: (filename: string) => `drills/${filename}`,
  
  /** Generate path for a swing clip */
  getSwingPath: (sessionId: string, swingIndex: number, extension: string) => 
    `swing-videos/${sessionId}/${swingIndex}.${extension}`,
} as const;

// ============================================================================
// TABLE CONSTANTS
// ============================================================================

/**
 * Table names to use consistently across the codebase
 */
export const VIDEO_TABLES = {
  /** Table for instructional content - DO NOT use for swing clips */
  DRILLS: 'drill_videos',
  
  /** Table for swing session metadata - DO NOT use for instructional content */
  SWING_SESSIONS: 'video_swing_sessions',
  
  /** Table for individual swing clips - DO NOT use for instructional content */
  SWING_CLIPS: 'video_swings',
} as const;

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validates that a video meets drill content requirements
 */
export function isDrillVideoValid(video: Partial<DrillVideo>): boolean {
  return Boolean(
    video.title &&
    video.video_url &&
    video.access_level &&
    video.video_type
  );
}

/**
 * Validates that a swing clip meets analyzer requirements
 */
export function isSwingClipValid(swing: Partial<VideoSwing>): boolean {
  return Boolean(
    swing.session_id &&
    swing.video_storage_path &&
    typeof swing.swing_index === 'number'
  );
}

/**
 * Check if a frame rate is suitable for swing analysis
 * Returns true if >= 120fps (optimal) or unknown (give benefit of doubt)
 */
export function isHighSpeedVideo(frameRate: number | null): boolean {
  if (frameRate === null) return true; // Unknown, allow it
  return frameRate >= 120;
}
