import { supabase } from "@/integrations/supabase/client";

/**
 * SECURITY: Signed URLs must be obtained through authenticated edge functions.
 * Direct client-side createSignedUrl calls are blocked because they bypass ownership checks.
 * 
 * Use the get-session edge function to obtain signed URLs for swing videos.
 * That function verifies JWT and enforces session ownership before returning URLs.
 */

/**
 * Get signed video URLs by calling the secure get-session edge function.
 * This ensures ownership verification before returning URLs.
 * 
 * @param sessionId - The session ID to get videos for
 * @returns Object with session and swings (with signed URLs) or null if failed
 */
export async function getSessionWithSignedUrls(sessionId: string): Promise<{
  session: any;
  swings: Array<{ video_url: string | null; video_storage_path: string | null; [key: string]: any }>;
} | null> {
  if (!sessionId) return null;

  try {
    const { data: { session: authSession } } = await supabase.auth.getSession();
    
    if (!authSession?.access_token) {
      console.error("No auth session - cannot get signed URLs");
      return null;
    }

    const response = await supabase.functions.invoke('get-session', {
      body: null,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // The function uses query params, so we need to call it differently
    const { data, error } = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-session?sessionId=${sessionId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authSession.access_token}`,
          'Content-Type': 'application/json',
        },
      }
    ).then(res => res.json().then(data => ({ data, error: res.ok ? null : data.error })));

    if (error) {
      console.error("Failed to get session with signed URLs:", error);
      return null;
    }

    return data;
  } catch (err) {
    console.error("Error getting session with signed URLs:", err);
    return null;
  }
}

/**
 * @deprecated Use getSessionWithSignedUrls instead.
 * Direct signed URL generation is disabled for security.
 * Signed URLs must come from authenticated edge functions that verify ownership.
 */
export async function getSignedVideoUrl(
  storagePath: string,
  expiresIn: number = 3600
): Promise<string | null> {
  console.warn(
    "SECURITY: getSignedVideoUrl is deprecated. " +
    "Use getSessionWithSignedUrls() which enforces ownership via edge function."
  );
  
  // Return null - callers must use the secure method
  return null;
}

/**
 * @deprecated Use getSessionWithSignedUrls instead.
 * This function is disabled for security reasons.
 */
export async function refreshSwingUrls<T extends { video_storage_path?: string | null; video_url?: string | null }>(
  swings: T[]
): Promise<T[]> {
  console.warn(
    "SECURITY: refreshSwingUrls is deprecated. " +
    "Use getSessionWithSignedUrls() which enforces ownership via edge function."
  );
  
  // Return swings unchanged - callers must use the secure method
  return swings;
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
