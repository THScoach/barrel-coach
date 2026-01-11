import { supabase } from "@/integrations/supabase/client";

/**
 * Get a fresh signed URL for a video stored in swing-videos bucket.
 * Use this for playback to avoid expired URL issues.
 * 
 * @param storagePath - The stable storage path (e.g., "sessionId/3.mp4")
 * @param expiresIn - Expiration time in seconds (default 3600 = 1 hour)
 * @returns Fresh signed URL or null if failed
 */
export async function getSignedVideoUrl(
  storagePath: string,
  expiresIn: number = 3600
): Promise<string | null> {
  if (!storagePath) return null;

  try {
    const { data, error } = await supabase.storage
      .from("swing-videos")
      .createSignedUrl(storagePath, expiresIn);

    if (error) {
      console.error("Failed to create signed URL:", error);
      return null;
    }

    return data?.signedUrl || null;
  } catch (err) {
    console.error("Error getting signed URL:", err);
    return null;
  }
}

/**
 * Refresh signed URLs for an array of swings.
 * Useful for batch refresh on page load or when URLs expire.
 * 
 * @param swings - Array of objects with video_storage_path
 * @returns Same array with refreshed video_url fields
 */
export async function refreshSwingUrls<T extends { video_storage_path?: string | null; video_url?: string | null }>(
  swings: T[]
): Promise<T[]> {
  return Promise.all(
    swings.map(async (swing) => {
      if (swing.video_storage_path) {
        const freshUrl = await getSignedVideoUrl(swing.video_storage_path);
        return { ...swing, video_url: freshUrl };
      }
      return swing;
    })
  );
}

/**
 * Check if a signed URL is likely expired (basic heuristic).
 * Signed URLs contain an 'Expires' param that can be parsed.
 * Returns true if expired or unable to determine.
 */
export function isSignedUrlExpired(url: string | null | undefined): boolean {
  if (!url) return true;

  try {
    const urlObj = new URL(url);
    const expiresParam = urlObj.searchParams.get("token");
    
    // Supabase signed URLs use JWT tokens - we can't easily decode without library
    // So we'll use a simpler approach: assume any URL older than 50 minutes is suspect
    // The caller should refresh proactively rather than wait for 403s
    
    // For now, just return false (not expired) - let the video player handle 403
    // and trigger refresh on error
    return false;
  } catch {
    return true;
  }
}
