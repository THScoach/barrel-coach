import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type SegmentMode = "hitter" | "bat" | "barrel" | "background" | "custom";

export interface PointPrompt {
  x: number;
  y: number;
  label: 0 | 1; // 0 = negative (exclude), 1 = positive (include)
}

export interface BoxPrompt {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface SegmentResult {
  maskUrl: string;
  mode: SegmentMode;
  processingTime: number;
}

export interface SegmentOptions {
  imageUrl?: string;
  imageDataUrl?: string;
  mode?: SegmentMode;
  prompt?: string;
  points?: PointPrompt[];
  box?: BoxPrompt;
}

export interface UseSAM3SegmentReturn {
  segment: (options: SegmentOptions) => Promise<SegmentResult | null>;
  isProcessing: boolean;
  error: string | null;
  lastResult: SegmentResult | null;
}

export function useSAM3Segment(): UseSAM3SegmentReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<SegmentResult | null>(null);

  const segment = useCallback(async (options: SegmentOptions): Promise<SegmentResult | null> => {
    const { imageUrl, imageDataUrl, mode = "custom", prompt, points, box } = options;

    if (!imageUrl && !imageDataUrl) {
      setError("imageUrl or imageDataUrl is required");
      return null;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("sam3-segment", {
        body: { imageUrl, imageDataUrl, mode, prompt, points, box },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      const result: SegmentResult = {
        maskUrl: data.maskUrl,
        mode: data.mode as SegmentMode,
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
