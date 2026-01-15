// =============================================================================
// SECURITY SELF-TEST CHECKLIST
// =============================================================================
// ✅ 1. Admin check via has_role() RPC happens BEFORE any database mutations
// ✅ 2. Returns 403 { error: "Admin access required" } if not admin (line 44-48)
// ✅ 3. User verified via auth.getUser() before role check (line 29-35)
// ✅ 4. Service_role client created at start but mutations only after admin check
// ✅ 5. No storage/DB writes occur before admin check completes (line 51+)
// ✅ 6. Request body parsed AFTER admin verification (line 51-59)
// =============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    // Check admin role
    const { data: isAdmin } = await supabase.rpc("has_role", { 
      _user_id: user.id, 
      _role: "admin" 
    });

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    const { 
      urls, 
      autoPublish = false, 
      forSwingAnalysis = false,
      forFreeDiagnostic = false,
      playerId,
      sessionDate,
      context = 'practice',
      source = 'admin_upload',
      playerName,
      playerEmail,
      playerLevel = 'youth',
    } = await req.json();

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return new Response(
        JSON.stringify({ error: "urls array is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const results: { url: string; success: boolean; error?: string; videoId?: string }[] = [];
    const importedVideos: { url: string; storagePath: string; filename: string }[] = [];
    let sessionId: string | null = null;

    // For swing analysis or free diagnostic, create a session in the `sessions` table
    if (forSwingAnalysis || forFreeDiagnostic) {
      const sessionInsert: Record<string, unknown> = {
        product_type: forFreeDiagnostic ? 'free_diagnostic' : 'krs_assessment',
        player_name: playerName || 'Unknown',
        player_email: playerEmail || 'unknown@example.com',
        player_level: playerLevel,
        environment: 'production',
        status: 'pending_analysis',
        swing_count: urls.length,
        player_id: playerId || null,
        created_by: user.id,
        user_id: user.id,
      };

      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .insert(sessionInsert)
        .select('id')
        .single();

      if (sessionError || !sessionData) {
        return new Response(
          JSON.stringify({ error: `Failed to create session: ${sessionError?.message}` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }
      sessionId = sessionData.id;
      console.log(`Created session: ${sessionId}`);
    }

    let swingIndex = 0;

    for (const onformUrl of urls) {
      try {
        console.log(`Processing OnForm URL: ${onformUrl}`);
        
        // Extract video ID from OnForm URL
        let videoId: string | null = null;
        
        // Handle different OnForm URL formats
        const urlObj = new URL(onformUrl);
        if (urlObj.hostname === "link.getonform.com") {
          videoId = urlObj.searchParams.get("id");
        } else if (urlObj.hostname === "web.onform.com") {
          // Handle web.onform.com URLs - extract ID from path
          const pathMatch = onformUrl.match(/\/(?:video|v)\/([A-Za-z0-9]+)/);
          if (pathMatch) {
            videoId = pathMatch[1];
          }
        }

        if (!videoId) {
          results.push({ url: onformUrl, success: false, error: "Could not extract video ID from URL" });
          continue;
        }

        console.log(`Extracted video ID: ${videoId}`);

        // Fetch the OnForm page to get the signed download URL
        const pageUrl = `https://link.getonform.com/view?id=${videoId}`;
        const pageResponse = await fetch(pageUrl);
        
        if (!pageResponse.ok) {
          results.push({ url: onformUrl, success: false, error: `Failed to fetch OnForm page: ${pageResponse.status}` });
          continue;
        }

        const pageHtml = await pageResponse.text();
        
        // Extract the Google Cloud Storage signed URL from the page
        // Pattern: href to storage.googleapis.com/us-videos/original/...
        const downloadUrlMatch = pageHtml.match(/https:\/\/storage\.googleapis\.com\/us-videos\/original\/[^"'\s]+/);
        
        if (!downloadUrlMatch) {
          results.push({ url: onformUrl, success: false, error: "Could not find video download URL in page" });
          continue;
        }

        const downloadUrl = downloadUrlMatch[0].replace(/&amp;/g, "&");
        console.log(`Found download URL for ${videoId}`);

        // Download the video
        const videoResponse = await fetch(downloadUrl);
        
        if (!videoResponse.ok) {
          results.push({ url: onformUrl, success: false, error: `Failed to download video: ${videoResponse.status}` });
          continue;
        }

        const videoBlob = await videoResponse.blob();
        const videoBuffer = await videoBlob.arrayBuffer();
        
        console.log(`Downloaded video: ${videoBlob.size} bytes`);

        // Upload to Supabase storage
        const filename = `${crypto.randomUUID()}.mp4`;
        let storagePath: string;
        let bucket: string;

        if ((forSwingAnalysis || forFreeDiagnostic) && sessionId) {
          // Store in swing-videos bucket under session folder
          bucket = "swing-videos";
          storagePath = `${sessionId}/${swingIndex}.mp4`;
        } else {
          // Store in videos bucket under drills folder
          bucket = "videos";
          storagePath = `drills/${filename}`;
        }

        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(storagePath, new Uint8Array(videoBuffer), {
            contentType: "video/mp4",
            upsert: true
          });

        if (uploadError) {
          results.push({ url: onformUrl, success: false, error: `Storage upload failed: ${uploadError.message}` });
          continue;
        }

        console.log(`Uploaded to storage: ${bucket}/${storagePath}`);

        if ((forSwingAnalysis || forFreeDiagnostic) && sessionId) {
          // Get signed URL for the video
          const { data: urlData } = await supabase.storage
            .from(bucket)
            .createSignedUrl(storagePath, 3600 * 24 * 365); // 1 year

          const signedVideoUrl = urlData?.signedUrl || null;

          // Create swings record in production `swings` table
          const { data: swingData, error: swingError } = await supabase
            .from('swings')
            .insert({
              session_id: sessionId,
              swing_index: swingIndex,
              video_url: signedVideoUrl,
              status: 'uploaded',
            })
            .select('id')
            .single();

          if (swingError) {
            console.error('Error creating swing record:', swingError);
            results.push({ url: onformUrl, success: false, error: `Swing record failed: ${swingError.message}` });
            continue;
          }

          // For free diagnostic, also upsert swing_analyses with processing status
          if (forFreeDiagnostic && swingData) {
            const { error: analysisError } = await supabase
              .from('swing_analyses')
              .insert({
                session_id: sessionId,
                player_id: playerId || null,
                video_url: signedVideoUrl,
                video_name: `OnForm-${videoId}`,
                primary_problem: 'pending', // Required field
                free_diagnostic_report: {
                  status: 'processing',
                  created_at: new Date().toISOString(),
                  source: 'onform',
                },
              });

            if (analysisError) {
              console.error('Error creating swing_analyses record:', analysisError);
              // Non-fatal, continue
            } else {
              console.log('Created swing_analyses record for free diagnostic');
            }
          }

          importedVideos.push({
            url: signedVideoUrl || '',
            storagePath,
            filename: `swing-${swingIndex}.mp4`
          });
          
          swingIndex++;
          results.push({ url: onformUrl, success: true, videoId: sessionId });
          console.log(`Created swing record for swing ${swingIndex - 1}`);

        } else {
          // Get public URL for drill videos
          const { data: publicUrlData } = supabase.storage
            .from(bucket)
            .getPublicUrl(storagePath);

          // Create video record in drill_videos table
          const { data: videoRecord, error: insertError } = await supabase
            .from("drill_videos")
            .insert({
              title: `OnForm Import - ${videoId}`,
              video_url: publicUrlData.publicUrl,
              status: "processing",
              access_level: "paid",
              video_type: "drill",
            })
            .select()
            .single();

          if (insertError) {
            results.push({ url: onformUrl, success: false, error: `Database insert failed: ${insertError.message}` });
            continue;
          }

          console.log(`Created drill_videos record: ${videoRecord.id}`);

          // Trigger transcription pipeline
          try {
            await fetch(`${supabaseUrl}/functions/v1/upload-video`, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${supabaseServiceKey}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                storage_path: storagePath,
                original_title: `OnForm - ${videoId}`,
                auto_publish: autoPublish,
                video_id: videoRecord.id
              })
            });
          } catch (pipelineError) {
            console.error("Pipeline trigger error:", pipelineError);
          }

          results.push({ url: onformUrl, success: true, videoId: videoRecord.id });
        }

        console.log(`Successfully imported: ${onformUrl}`);

      } catch (error) {
        console.error(`Error processing ${onformUrl}:`, error);
        results.push({ 
          url: onformUrl, 
          success: false, 
          error: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }

    // Update session with actual count
    if ((forSwingAnalysis || forFreeDiagnostic) && sessionId) {
      const successCount = results.filter(r => r.success).length;
      await supabase
        .from('sessions')
        .update({ swing_count: successCount })
        .eq('id', sessionId);
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Imported ${successCount} video(s)${failCount > 0 ? `, ${failCount} failed` : ""}`,
        results,
        sessionId,
        videos: importedVideos
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    console.error("Import OnForm video error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
