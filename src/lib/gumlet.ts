/**
 * Gumlet Video Service Configuration and Helpers
 * 
 * Gumlet provides adaptive streaming, transcoding, and CDN delivery for videos.
 * This module handles URL conversion, quality presets, and video processing.
 */

// Gumlet Configuration
export const GUMLET_CONFIG = {
  // Base URL for Gumlet video delivery
  baseUrl: 'https://video.gumlet.io',
  
  // API endpoint for uploads and management
  apiUrl: 'https://api.gumlet.com/v1',
  
  // Collection ID from environment (set in secrets)
  collectionId: import.meta.env.VITE_GUMLET_COLLECTION_ID || '',
  
  // Default video settings
  defaults: {
    autoplay: false,
    muted: true,
    preload: 'metadata' as const,
    controls: true,
  },
};

// Video Quality Presets
export const VIDEO_QUALITY_PRESETS = {
  auto: { label: 'Auto', resolution: null },
  '1080p': { label: '1080p HD', resolution: 1080 },
  '720p': { label: '720p', resolution: 720 },
  '480p': { label: '480p', resolution: 480 },
  '360p': { label: '360p', resolution: 360 },
  '240p': { label: '240p', resolution: 240 },
} as const;

export type VideoQuality = keyof typeof VIDEO_QUALITY_PRESETS;

// Adaptive Streaming Settings
export const STREAMING_SETTINGS = {
  // HLS settings
  hls: {
    enabled: true,
    segmentDuration: 6,
    playlistType: 'event' as const,
  },
  
  // DASH settings
  dash: {
    enabled: true,
    segmentDuration: 6,
  },
  
  // Adaptive bitrate settings
  abr: {
    enabled: true,
    initialLevel: -1, // Auto
    maxBufferLength: 30,
    maxBufferSize: 60 * 1000 * 1000, // 60MB
  },
};

// Video format types
export interface GumletVideoAsset {
  id: string;
  status: 'queued' | 'processing' | 'ready' | 'failed';
  playbackUrl: string | null;
  hlsUrl: string | null;
  dashUrl: string | null;
  thumbnailUrl: string | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  createdAt: string;
}

export interface GumletUploadResponse {
  asset_id: string;
  status: string;
  playback_url?: string;
  hls_url?: string;
  dash_url?: string;
  thumbnail_url?: string;
}

/**
 * Check if Gumlet is configured
 */
export function isGumletConfigured(): boolean {
  return Boolean(GUMLET_CONFIG.collectionId);
}

/**
 * Convert a storage URL to a Gumlet playback URL
 * This proxies video through Gumlet for adaptive streaming
 */
export function convertToGumletUrl(
  originalUrl: string,
  options: {
    quality?: VideoQuality;
    format?: 'hls' | 'dash' | 'mp4';
  } = {}
): string {
  if (!isGumletConfigured() || !originalUrl) {
    return originalUrl;
  }

  const { quality = 'auto', format = 'hls' } = options;
  
  // If it's already a Gumlet URL, return as-is
  if (originalUrl.includes('gumlet.io') || originalUrl.includes('gumlet.com')) {
    return originalUrl;
  }

  // For now, return original URL - the actual Gumlet URL will be stored in DB
  // after upload processing
  return originalUrl;
}

/**
 * Get the best streaming URL for a video
 * Prefers HLS, falls back to DASH, then MP4
 */
export function getBestStreamingUrl(asset: GumletVideoAsset): string | null {
  if (asset.hlsUrl) return asset.hlsUrl;
  if (asset.dashUrl) return asset.dashUrl;
  if (asset.playbackUrl) return asset.playbackUrl;
  return null;
}

/**
 * Parse a Gumlet asset response into our format
 */
export function parseGumletAsset(response: any): GumletVideoAsset {
  return {
    id: response.asset_id || response.id,
    status: mapGumletStatus(response.status),
    playbackUrl: response.playback_url || null,
    hlsUrl: response.hls_url || response.output_hls_url || null,
    dashUrl: response.dash_url || response.output_dash_url || null,
    thumbnailUrl: response.thumbnail_url || response.poster_url || null,
    duration: response.duration || null,
    width: response.width || null,
    height: response.height || null,
    createdAt: response.created_at || new Date().toISOString(),
  };
}

function mapGumletStatus(status: string): GumletVideoAsset['status'] {
  switch (status?.toLowerCase()) {
    case 'queued':
    case 'pending':
      return 'queued';
    case 'processing':
    case 'encoding':
      return 'processing';
    case 'ready':
    case 'completed':
    case 'finished':
      return 'ready';
    case 'failed':
    case 'error':
      return 'failed';
    default:
      return 'processing';
  }
}

/**
 * Format duration in seconds to MM:SS or HH:MM:SS
 */
export function formatVideoDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return '--:--';
  
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Get video quality label
 */
export function getQualityLabel(quality: VideoQuality): string {
  return VIDEO_QUALITY_PRESETS[quality]?.label || 'Auto';
}

/**
 * Detect if HLS is supported in the browser
 */
export function isHlsSupported(): boolean {
  const video = document.createElement('video');
  return Boolean(
    video.canPlayType('application/vnd.apple.mpegurl') ||
    // Check for MSE support for hls.js
    (typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported('video/mp4'))
  );
}

/**
 * Detect if DASH is supported in the browser
 */
export function isDashSupported(): boolean {
  return typeof MediaSource !== 'undefined' && 
    MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E"');
}
