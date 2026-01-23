import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PostRequest {
  content_output_id: string;
  platform?: string; // Override platform if needed
  schedule_for?: string; // ISO timestamp for scheduled posting
}

interface TwitterPostResult {
  success: boolean;
  tweet_id?: string;
  url?: string;
  error?: string;
}

interface MetaPostResult {
  success: boolean;
  post_id?: string;
  url?: string;
  error?: string;
}

// Twitter OAuth 1.0a signature helper (simplified - in production use proper OAuth lib)
async function createTwitterSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): Promise<string> {
  const encoder = new TextEncoder();
  
  // Sort and encode parameters
  const sortedParams = Object.keys(params)
    .sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join("&");
  
  const signatureBase = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(signingKey),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(signatureBase));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

async function postToTwitter(content: string, hashtags: string[]): Promise<TwitterPostResult> {
  const consumerKey = Deno.env.get("TWITTER_CONSUMER_KEY");
  const consumerSecret = Deno.env.get("TWITTER_CONSUMER_SECRET");
  const accessToken = Deno.env.get("TWITTER_ACCESS_TOKEN");
  const accessTokenSecret = Deno.env.get("TWITTER_ACCESS_TOKEN_SECRET");
  
  if (!consumerKey || !consumerSecret || !accessToken || !accessTokenSecret) {
    return { success: false, error: "Twitter API credentials not configured" };
  }
  
  try {
    // Format tweet with hashtags (if space permits)
    let tweetText = content;
    const hashtagText = hashtags.slice(0, 2).map(h => `#${h}`).join(" ");
    if (tweetText.length + hashtagText.length + 1 <= 280) {
      tweetText = `${content}\n\n${hashtagText}`;
    }
    
    // Twitter API v2 endpoint
    const url = "https://api.twitter.com/2/tweets";
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomUUID().replace(/-/g, "");
    
    const oauthParams: Record<string, string> = {
      oauth_consumer_key: consumerKey,
      oauth_nonce: nonce,
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp: timestamp,
      oauth_token: accessToken,
      oauth_version: "1.0",
    };
    
    const signature = await createTwitterSignature(
      "POST",
      url,
      oauthParams,
      consumerSecret,
      accessTokenSecret
    );
    
    oauthParams.oauth_signature = signature;
    
    const authHeader = "OAuth " + Object.entries(oauthParams)
      .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
      .join(", ");
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: tweetText }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Twitter API error:", errorText);
      return { success: false, error: `Twitter API error: ${response.status}` };
    }
    
    const data = await response.json();
    const tweetId = data.data?.id;
    
    return {
      success: true,
      tweet_id: tweetId,
      url: tweetId ? `https://twitter.com/i/web/status/${tweetId}` : undefined,
    };
  } catch (error) {
    console.error("Twitter post error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

async function postToMeta(
  content: string, 
  hashtags: string[], 
  platform: "instagram" | "facebook"
): Promise<MetaPostResult> {
  const accessToken = Deno.env.get("META_ACCESS_TOKEN");
  const pageId = Deno.env.get("META_PAGE_ID");
  
  if (!accessToken || !pageId) {
    return { success: false, error: "Meta API credentials not configured" };
  }
  
  try {
    // Format caption with hashtags
    const hashtagText = hashtags.map(h => `#${h}`).join(" ");
    const caption = `${content}\n\n${hashtagText}`;
    
    // For Instagram, we use the Instagram Graph API
    // For Facebook, we use the Pages API
    const baseUrl = platform === "instagram" 
      ? `https://graph.facebook.com/v18.0/${pageId}/media`
      : `https://graph.facebook.com/v18.0/${pageId}/feed`;
    
    // Note: Instagram requires media (image/video) - this is for text posts only
    // For Instagram with media, you'd need to upload media first
    
    if (platform === "instagram") {
      // Instagram requires media - return error for text-only
      return { 
        success: false, 
        error: "Instagram requires media. Use with video/image content." 
      };
    }
    
    // Facebook text post
    const response = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: caption,
        access_token: accessToken,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Meta API error:", errorText);
      return { success: false, error: `Meta API error: ${response.status}` };
    }
    
    const data = await response.json();
    const postId = data.id;
    
    return {
      success: true,
      post_id: postId,
      url: postId ? `https://facebook.com/${postId}` : undefined,
    };
  } catch (error) {
    console.error("Meta post error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

async function postToTikTok(content: string): Promise<{ success: boolean; error?: string }> {
  const accessToken = Deno.env.get("TIKTOK_ACCESS_TOKEN");
  
  if (!accessToken) {
    return { success: false, error: "TikTok API credentials not configured" };
  }
  
  // TikTok Content Posting API requires video content
  // Text-only posts are not supported
  return { 
    success: false, 
    error: "TikTok requires video content. Use with video uploads." 
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content_output_id, schedule_for }: PostRequest = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the content output
    const { data: output, error: fetchError } = await supabase
      .from("content_outputs")
      .select("*")
      .eq("id", content_output_id)
      .single();

    if (fetchError || !output) {
      throw new Error("Content output not found");
    }

    // Check if already posted
    if (output.status === "posted" && output.post_url) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Content already posted",
          post_url: output.post_url,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If scheduling for later
    if (schedule_for) {
      await supabase
        .from("content_outputs")
        .update({
          status: "scheduled",
          scheduled_for: schedule_for,
        })
        .eq("id", content_output_id);

      return new Response(
        JSON.stringify({ 
          success: true, 
          scheduled: true,
          scheduled_for: schedule_for,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const platform = output.platform;
    const content = output.formatted_content;
    const hashtags = output.hashtags || [];

    let result: { success: boolean; url?: string; error?: string };

    // Route to appropriate platform
    switch (platform) {
      case "twitter":
      case "twitter_thread":
        result = await postToTwitter(content, hashtags);
        break;
        
      case "instagram_post":
      case "instagram_reel":
      case "instagram_story":
        result = await postToMeta(content, hashtags, "instagram");
        break;
        
      case "facebook":
        result = await postToMeta(content, hashtags, "facebook");
        break;
        
      case "tiktok":
        result = await postToTikTok(content);
        break;
        
      default:
        result = { success: false, error: `Platform ${platform} not supported for direct posting` };
    }

    // Update the content output with result
    if (result.success) {
      await supabase
        .from("content_outputs")
        .update({
          status: "posted",
          posted_at: new Date().toISOString(),
          post_url: result.url,
        })
        .eq("id", content_output_id);
    } else {
      await supabase
        .from("content_outputs")
        .update({
          status: "failed",
          performance_metrics: {
            ...(output.performance_metrics || {}),
            post_error: result.error,
            post_attempted_at: new Date().toISOString(),
          },
        })
        .eq("id", content_output_id);
    }

    return new Response(
      JSON.stringify({
        success: result.success,
        platform,
        post_url: result.url,
        error: result.error,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Post to social error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
