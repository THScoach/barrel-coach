import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type SegmentMode = "hitter" | "bat" | "barrel" | "background";

export interface SegmentResult {
  maskUrl: string;
  mode: SegmentMode;
  processingTime: number;
}

export interface UseSAM3SegmentReturn {
  segment: (imageUrl: string, mode: SegmentMode, prompt?: string) => Promise<SegmentResult | null>;
  isProcessing: boolean;
  error: string | null;
  lastResult: SegmentResult | null;
}

export function useSAM3Segment(): UseSAM3SegmentReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<SegmentResult | null>(null);

  const segment = useCallback(async (
    imageUrl: string,
    mode: SegmentMode,
    prompt?: string
  ): Promise<SegmentResult | null> => {
    setIsProcessing(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("sam3-segment", {
        body: { imageUrl, mode, prompt },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      const result: SegmentResult = {
        maskUrl: data.maskUrl,
        mode: data.mode,
        processingTime: data.processingTime,
      };

      setLastResult(result);
      return result;

    } catch (err) {
      const message = err instanceof Error ? err.message : "Segmentation failed";
      setError(message);
      toast.error("Segmentation failed", { description: message });
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  return { segment, isProcessing, error, lastResult };
}
