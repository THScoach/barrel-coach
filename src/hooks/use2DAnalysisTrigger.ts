/**
 * Hook to trigger analyze-video-2d for each uploaded swing after batch upload completes.
 * Extracts frames client-side, creates a batch session, then fires analysis per swing.
 */
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { extractFrames } from "@/utils/extractFrames";
import { toast } from "sonner";

interface AnalysisProgress {
  total: number;
  completed: number;
  failed: number;
  status: "idle" | "extracting" | "analyzing" | "polling" | "done" | "error";
  batchSessionId: string | null;
}

interface SwingFile {
  file: File;
  storagePath: string;
  swingIndex: number;
}

export function use2DAnalysisTrigger() {
  const [progress, setProgress] = useState<AnalysisProgress>({
    total: 0,
    completed: 0,
    failed: 0,
    status: "idle",
    batchSessionId: null,
  });

  const triggerAnalysis = useCallback(
    async (playerId: string, swings: SwingFile[], rebootPlayerId?: string | null) => {
      if (swings.length === 0) return null;

      setProgress({ total: swings.length, completed: 0, failed: 0, status: "extracting", batchSessionId: null });

      try {
        // 1. Create batch session
        const sessionDate = new Date().toISOString().split("T")[0];
        const { data: batch, error: batchErr } = await supabase
          .from("video_2d_batch_sessions")
          .insert({
            player_id: playerId,
            session_date: sessionDate,
            swing_count: swings.length,
            status: "processing",
            session_type: "player_upload",
          })
          .select("id")
          .single();

        if (batchErr || !batch) {
          console.error("[2D Trigger] Failed to create batch session:", batchErr);
          throw new Error("Failed to create analysis batch");
        }

        const batchSessionId = batch.id;
        setProgress((p) => ({ ...p, batchSessionId }));

        // 2. For each swing, extract frames + call analyze-video-2d
        setProgress((p) => ({ ...p, status: "analyzing" }));

        const sessionIds: string[] = [];
        let completed = 0;
        let failed = 0;

        for (const swing of swings) {
          try {
            // Extract frames from the video file
            const frames = await extractFrames(swing.file);

            // Get public URL for the stored video
            const { data: urlData } = supabase.storage
              .from("swing-videos")
              .getPublicUrl(swing.storagePath);

            // Call analyze-video-2d
            const { data, error } = await supabase.functions.invoke("analyze-video-2d", {
              body: {
                player_id: playerId,
                video_url: urlData.publicUrl,
                video_filename: swing.file.name,
                video_storage_path: swing.storagePath,
                frames,
                batch_session_id: batchSessionId,
                swing_index: swing.swingIndex,
              },
            });

            if (error || !data?.success) {
              console.error(`[2D Trigger] Analysis failed for swing ${swing.swingIndex}:`, error || data?.error);
              failed++;
            } else {
              sessionIds.push(data.session_id);
              completed++;
            }
          } catch (err) {
            console.error(`[2D Trigger] Error processing swing ${swing.swingIndex}:`, err);
            failed++;
          }

          setProgress((p) => ({ ...p, completed: completed, failed }));
        }

        // 3. Poll for completion
        if (sessionIds.length > 0) {
          setProgress((p) => ({ ...p, status: "polling" }));
          await pollForCompletion(sessionIds);
        }

        setProgress((p) => ({ ...p, status: "done" }));

        if (failed > 0) {
          toast.warning(`Analysis complete: ${completed} succeeded, ${failed} failed`);
        } else {
          toast.success(`All ${completed} swings analyzed!`);
        }

        // 4. Fire Reboot 3D upload in background if player has a Reboot account
        if (rebootPlayerId && swings.length > 0) {
          fireRebootUpload(playerId, swings[0], sessionIds).catch((err) =>
            console.error("[2D Trigger] Reboot upload background error:", err),
          );
        }

        return batchSessionId;
      } catch (err) {
        console.error("[2D Trigger] Fatal error:", err);
        setProgress((p) => ({ ...p, status: "error" }));
        toast.error("Failed to start swing analysis");
        return null;
      }
    },
    [],
  );

  return { triggerAnalysis, progress };
}

/**
 * Fire reboot-upload-video in the background for the first swing's video.
 * Marks associated 2D sessions as pending_3d_analysis.
 */
async function fireRebootUpload(
  playerId: string,
  firstSwing: SwingFile,
  sessionIds: string[],
) {
  try {
    console.log("[2D Trigger] Firing reboot-upload-video for 3D analysis...");

    // Get a signed URL for the video in swing-videos bucket
    const { data: signedData, error: signedError } = await supabase.storage
      .from("swing-videos")
      .createSignedUrl(firstSwing.storagePath, 3600);

    if (signedError || !signedData?.signedUrl) {
      console.error("[2D Trigger] Failed to get signed URL for Reboot upload:", signedError);
      return;
    }

    // Call reboot-upload-video edge function
    const { data, error } = await supabase.functions.invoke("reboot-upload-video", {
      body: {
        player_id: playerId,
        video_url: signedData.signedUrl,
        video_filename: firstSwing.file.name,
        frame_rate: 240,
      },
    });

    if (error) {
      console.error("[2D Trigger] Reboot upload failed:", error.message);
      return;
    }

    console.log("[2D Trigger] Reboot upload success, session:", data?.session_id);

    // Mark all 2D sessions as pending 3D analysis
    if (sessionIds.length > 0) {
      await supabase
        .from("video_2d_sessions")
        .update({ pending_3d_analysis: true })
        .in("id", sessionIds);
    }

    toast.info("🔬 3D analysis queued — results in 30-60 min", { duration: 6000 });
  } catch (err) {
    console.error("[2D Trigger] Reboot upload error:", err);
  }
}

async function pollForCompletion(sessionIds: string[], maxWaitMs = 120000) {
  const startTime = Date.now();
  const pollInterval = 3000;

  while (Date.now() - startTime < maxWaitMs) {
    const { data } = await supabase
      .from("video_2d_sessions")
      .select("id, processing_status")
      .in("id", sessionIds);

    if (data) {
      const allDone = data.every(
        (s) => s.processing_status === "complete" || s.processing_status === "error",
      );
      if (allDone) return;
    }

    await new Promise((r) => setTimeout(r, pollInterval));
  }
}
