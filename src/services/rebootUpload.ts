/**
 * Reboot Video Upload Service
 * ============================
 * Handles the full upload flow:
 * 1. Upload video to Supabase storage (reboot-uploads bucket)
 * 2. Call reboot-upload-video edge function with the storage URL
 * 3. Edge function handles the Reboot API 3-step flow securely
 */

import { supabase } from '@/integrations/supabase/client';

export type UploadStatus = 'idle' | 'validating' | 'uploading' | 'processing' | 'complete' | 'error';

export interface UploadProgress {
  status: UploadStatus;
  percentage: number;
  message: string;
  sessionId?: string;
  error?: string;
}

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
const ALLOWED_TYPES = ['video/mp4', 'video/quicktime'];
const ALLOWED_EXTENSIONS = ['.mp4', '.mov'];

export function validateVideoFile(file: File): string | null {
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return `Invalid file type "${ext}". Only .mp4 and .mov are accepted.`;
  }
  if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXTENSIONS.includes(ext)) {
    return `Invalid MIME type "${file.type}". Only MP4 and MOV videos are accepted.`;
  }
  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = Math.round(file.size / (1024 * 1024));
    return `File is ${sizeMB}MB. Maximum allowed is 500MB.`;
  }
  return null;
}

export async function uploadVideoToReboot(
  file: File,
  playerId: string,
  onProgress: (progress: UploadProgress) => void,
  frameRate: number = 240,
): Promise<{ sessionId: string }> {
  // Step 1: Validate
  onProgress({ status: 'validating', percentage: 0, message: 'Validating file…' });
  const validationError = validateVideoFile(file);
  if (validationError) {
    throw new Error(validationError);
  }

  // Step 2: Upload to Supabase storage
  onProgress({ status: 'uploading', percentage: 5, message: 'Uploading video…' });

  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${playerId}/${timestamp}_${safeName}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('reboot-uploads')
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  onProgress({ status: 'uploading', percentage: 60, message: 'Video uploaded to storage' });

  // Get public URL for the edge function to download
  const { data: urlData } = supabase.storage
    .from('reboot-uploads')
    .getPublicUrl(storagePath);

  // Since bucket is private, use a signed URL
  const { data: signedData, error: signedError } = await supabase.storage
    .from('reboot-uploads')
    .createSignedUrl(storagePath, 3600); // 1 hour expiry

  if (signedError || !signedData?.signedUrl) {
    throw new Error('Failed to generate download URL for video');
  }

  // Step 3: Call edge function
  onProgress({ status: 'processing', percentage: 70, message: 'Sending to Reboot Motion…' });

  const { data, error } = await supabase.functions.invoke('reboot-upload-video', {
    body: {
      player_id: playerId,
      video_url: signedData.signedUrl,
      video_filename: safeName,
      frame_rate: frameRate,
    },
  });

  if (error) {
    // Check for auth errors
    if (error.message?.includes('401') || error.message?.includes('unauthorized')) {
      throw new Error('Reboot API authentication failed. Please check API credentials.');
    }
    throw new Error(`Reboot upload failed: ${error.message}`);
  }

  if (!data?.session_id) {
    throw new Error('No session ID returned from Reboot Motion');
  }

  onProgress({
    status: 'complete',
    percentage: 100,
    message: `Video uploaded to Reboot Motion for processing. Session ID: ${data.session_id}`,
    sessionId: data.session_id,
  });

  return { sessionId: data.session_id };
}
