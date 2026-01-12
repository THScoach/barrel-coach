import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AnalysisScores {
  sequence_score: number | null;
  barrel_quality_score: number | null;
  contact_optimization_score: number | null;
  sequence_match: boolean | null;
  sequence_order: string[] | null;
  sequence_errors: any[] | null;
  notes: string | null;
}

interface AnalysisResult {
  success: boolean;
  cached?: boolean;
  data?: {
    sessionId: string;
    swingCount?: number;
    analyzedCount?: number;
    inSequenceCount?: number;
    scores: AnalysisScores;
    metrics: any[];
    swingResults?: any[];
  };
  error?: string;
}

interface UseAnalyzeVideoSwingSessionReturn {
  analyze: (sessionId: string, forceRecompute?: boolean) => Promise<AnalysisResult | null>;
  isAnalyzing: boolean;
  analyzingSessionId: string | null;
  error: string | null;
  lastResult: AnalysisResult | null;
}

/**
 * Hook for analyzing video swing sessions using the Body→Bat momentum analysis
 */
export function useAnalyzeVideoSwingSession(): UseAnalyzeVideoSwingSessionReturn {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzingSessionId, setAnalyzingSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<AnalysisResult | null>(null);

  const analyze = useCallback(async (
    sessionId: string, 
    forceRecompute: boolean = false
  ): Promise<AnalysisResult | null> => {
    setIsAnalyzing(true);
    setAnalyzingSessionId(sessionId);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        'analyze-video-swing-session',
        {
          body: { sessionId, forceRecompute },
        }
      );

      if (fnError) {
        throw new Error(fnError.message || 'Analysis failed');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Analysis returned unsuccessful');
      }

      const result: AnalysisResult = {
        success: true,
        cached: data.cached,
        data: data.data,
      };

      setLastResult(result);

      // Show success toast
      const swingCount = result.data?.swingCount || 0;
      const inSeq = result.data?.inSequenceCount || 0;
      const score = result.data?.scores?.sequence_score || 0;
      
      if (result.cached) {
        toast.success('Loaded cached analysis results');
      } else {
        toast.success(
          `Analysis complete! Score: ${score}`,
          {
            description: `${inSeq}/${swingCount} swings in sequence`,
          }
        );
      }

      return result;
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to analyze session';
      setError(errorMessage);
      setLastResult({ success: false, error: errorMessage });
      
      toast.error('Analysis failed', {
        description: errorMessage,
      });

      return null;
    } finally {
      setIsAnalyzing(false);
      setAnalyzingSessionId(null);
    }
  }, []);

  return {
    analyze,
    isAnalyzing,
    analyzingSessionId,
    error,
    lastResult,
  };
}
