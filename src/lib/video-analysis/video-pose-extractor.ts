/**
 * Video Pose Extractor
 * ============================================================================
 * Extracts pose landmarks from video using MediaPipe Pose
 * Works in browser (via @mediapipe/pose) or server (via Python subprocess)
 * 
 * Usage:
 *   const extractor = new VideoPoseExtractor();
 *   const poses = await extractor.processVideo(videoElement);
 *   const analysis = analyzeBodyRotation(poses, frameRate);
 */

import type { PoseFrame, PoseLandmark } from './mediapipe-body-tracker';

// ============================================================================
// TYPES
// ============================================================================

export interface ExtractionOptions {
  /** Target frame rate for analysis (default: 30) */
  targetFps?: number;
  
  /** Start time in seconds (default: 0) */
  startTime?: number;
  
  /** End time in seconds (default: video duration) */
  endTime?: number;
  
  /** Model complexity: 0=Lite, 1=Full, 2=Heavy (default: 1) */
  modelComplexity?: 0 | 1 | 2;
  
  /** Minimum detection confidence (default: 0.5) */
  minDetectionConfidence?: number;
  
  /** Minimum tracking confidence (default: 0.5) */
  minTrackingConfidence?: number;
  
  /** Enable smooth landmarks (default: true) */
  smoothLandmarks?: boolean;
  
  /** Progress callback */
  onProgress?: (progress: number, status: string) => void;
}

export interface ExtractionResult {
  frames: PoseFrame[];
  frameRate: number;
  duration: number;
  width: number;
  height: number;
  extractedFrameCount: number;
  validFrameCount: number;
  processingTimeMs: number;
}

// ============================================================================
// BROWSER IMPLEMENTATION (MediaPipe JS)
// ============================================================================

/**
 * Extract poses from video in the browser using MediaPipe Pose
 * Requires @mediapipe/pose and @mediapipe/camera_utils packages
 */
export class BrowserPoseExtractor {
  private pose: any;  // MediaPipe Pose instance
  private isInitialized = false;
  
  async initialize(options: ExtractionOptions = {}): Promise<void> {
    if (this.isInitialized) return;
    
    // Dynamic import to avoid SSR issues
    const { Pose } = await import('@mediapipe/pose');
    
    this.pose = new Pose({
      locateFile: (file: string) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
      }
    });
    
    this.pose.setOptions({
      modelComplexity: options.modelComplexity ?? 1,
      smoothLandmarks: options.smoothLandmarks ?? true,
      minDetectionConfidence: options.minDetectionConfidence ?? 0.5,
      minTrackingConfidence: options.minTrackingConfidence ?? 0.5,
    });
    
    // Initialize model by processing a blank frame
    await new Promise<void>((resolve) => {
      this.pose.onResults(() => resolve());
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      this.pose.send({ image: canvas });
    });
    
    this.isInitialized = true;
  }
  
  async processVideo(
    video: HTMLVideoElement,
    options: ExtractionOptions = {}
  ): Promise<ExtractionResult> {
    const startTime = performance.now();
    
    await this.initialize(options);
    
    const {
      targetFps = 30,
      startTime: clipStart = 0,
      endTime: clipEnd = video.duration,
      onProgress,
    } = options;
    
    const frames: PoseFrame[] = [];
    const frameInterval = 1 / targetFps;
    const totalFrames = Math.ceil((clipEnd - clipStart) * targetFps);
    
    // Create offscreen canvas for frame extraction
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    
    // Process frames
    let currentTime = clipStart;
    let frameNumber = 0;
    let validFrameCount = 0;
    
    while (currentTime < clipEnd) {
      // Seek to frame
      video.currentTime = currentTime;
      await new Promise<void>((resolve) => {
        video.onseeked = () => resolve();
      });
      
      // Draw frame to canvas
      ctx.drawImage(video, 0, 0);
      
      // Run pose detection
      const result = await this.processFrame(canvas);
      
      if (result) {
        frames.push({
          timestamp: currentTime * 1000,  // Convert to ms
          frameNumber,
          landmarks: result,
        });
        validFrameCount++;
      } else {
        // Add empty frame to maintain timing
        frames.push({
          timestamp: currentTime * 1000,
          frameNumber,
          landmarks: Array(33).fill({ x: 0, y: 0, z: 0, visibility: 0 }),
        });
      }
      
      frameNumber++;
      currentTime += frameInterval;
      
      // Report progress
      if (onProgress) {
        const progress = (frameNumber / totalFrames) * 100;
        onProgress(progress, `Processing frame ${frameNumber}/${totalFrames}`);
      }
    }
    
    const processingTimeMs = performance.now() - startTime;
    
    return {
      frames,
      frameRate: targetFps,
      duration: clipEnd - clipStart,
      width: video.videoWidth,
      height: video.videoHeight,
      extractedFrameCount: frames.length,
      validFrameCount,
      processingTimeMs,
    };
  }
  
  private processFrame(canvas: HTMLCanvasElement): Promise<PoseLandmark[] | null> {
    return new Promise((resolve) => {
      this.pose.onResults((results: any) => {
        if (!results.poseLandmarks) {
          resolve(null);
          return;
        }
        
        const landmarks: PoseLandmark[] = results.poseLandmarks.map((lm: any) => ({
          x: lm.x,
          y: lm.y,
          z: lm.z,
          visibility: lm.visibility ?? 0,
        }));
        
        resolve(landmarks);
      });
      
      this.pose.send({ image: canvas });
    });
  }
  
  close(): void {
    if (this.pose) {
      this.pose.close();
      this.pose = null;
      this.isInitialized = false;
    }
  }
}

// ============================================================================
// SERVER IMPLEMENTATION (Python subprocess)
// ============================================================================

/**
 * Extract poses from video on the server using Python MediaPipe
 * This is more efficient for batch processing and supports more video formats
 */
export interface ServerExtractionRequest {
  videoUrl: string;
  options?: ExtractionOptions;
}

export interface ServerExtractionResponse {
  success: boolean;
  result?: ExtractionResult;
  error?: string;
}

/**
 * Process video using server-side Python MediaPipe
 * Calls a Supabase Edge Function that runs the Python extraction
 */
export async function extractPosesServer(
  videoUrl: string,
  options: ExtractionOptions = {},
  supabaseClient: any
): Promise<ExtractionResult> {
  const { data, error } = await supabaseClient.functions.invoke('mediapipe-extract', {
    body: {
      video_url: videoUrl,
      target_fps: options.targetFps ?? 30,
      start_time: options.startTime ?? 0,
      end_time: options.endTime,
      model_complexity: options.modelComplexity ?? 1,
      min_detection_confidence: options.minDetectionConfidence ?? 0.5,
      min_tracking_confidence: options.minTrackingConfidence ?? 0.5,
    }
  });
  
  if (error) {
    throw new Error(`Server extraction failed: ${error.message}`);
  }
  
  if (!data.success) {
    throw new Error(data.error || 'Unknown extraction error');
  }
  
  return data.result;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Load a video element from URL
 */
export function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.playsInline = true;
    video.muted = true;
    
    video.onloadedmetadata = () => {
      resolve(video);
    };
    
    video.onerror = () => {
      reject(new Error(`Failed to load video: ${url}`));
    };
    
    video.src = url;
    video.load();
  });
}

/**
 * Convert file to data URL for processing
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Estimate frame rate from video metadata or sampling
 */
export async function estimateFrameRate(video: HTMLVideoElement): Promise<number> {
  // Try to get from video metadata (Chrome)
  if ('getVideoPlaybackQuality' in video) {
    const quality = (video as any).getVideoPlaybackQuality();
    if (quality.totalVideoFrames > 0) {
      return quality.totalVideoFrames / video.duration;
    }
  }
  
  // Try to estimate from requestVideoFrameCallback (Chrome 83+)
  if ('requestVideoFrameCallback' in video) {
    return new Promise((resolve) => {
      let frameCount = 0;
      const startTime = performance.now();
      const duration = 500;  // Sample for 500ms
      
      video.play();
      
      const countFrame = () => {
        frameCount++;
        const elapsed = performance.now() - startTime;
        
        if (elapsed < duration) {
          (video as any).requestVideoFrameCallback(countFrame);
        } else {
          video.pause();
          video.currentTime = 0;
          const estimatedFps = Math.round(frameCount / (elapsed / 1000));
          resolve(estimatedFps);
        }
      };
      
      (video as any).requestVideoFrameCallback(countFrame);
    });
  }
  
  // Fallback to common frame rates based on duration
  return 30;  // Assume 30fps
}
