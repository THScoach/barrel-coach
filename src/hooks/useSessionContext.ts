import { useState, useCallback } from "react";
import type { HittingEnvironment, SessionContext } from "@/components/session/SessionSetupCard";

export interface FullSessionContext extends SessionContext {
  sessionId?: string;
  startedAt?: Date;
  swingCount?: number;
}

/**
 * Hook to manage the current session context state.
 * Stores environment and pitch speed settings for swing analysis.
 */
export function useSessionContext(initialContext?: Partial<FullSessionContext>) {
  const [context, setContext] = useState<FullSessionContext>({
    environment: initialContext?.environment || null,
    estimatedPitchSpeed: initialContext?.estimatedPitchSpeed || null,
    sessionId: initialContext?.sessionId,
    startedAt: initialContext?.startedAt,
    swingCount: initialContext?.swingCount || 0,
  });

  const setEnvironment = useCallback((environment: HittingEnvironment) => {
    setContext((prev) => ({ ...prev, environment }));
  }, []);

  const setPitchSpeed = useCallback((speed: number | null) => {
    setContext((prev) => ({ ...prev, estimatedPitchSpeed: speed }));
  }, []);

  const startSession = useCallback((sessionId?: string) => {
    setContext((prev) => ({
      ...prev,
      sessionId: sessionId || crypto.randomUUID(),
      startedAt: new Date(),
      swingCount: 0,
    }));
  }, []);

  const incrementSwingCount = useCallback(() => {
    setContext((prev) => ({
      ...prev,
      swingCount: (prev.swingCount || 0) + 1,
    }));
  }, []);

  const resetContext = useCallback(() => {
    setContext({
      environment: null,
      estimatedPitchSpeed: null,
      sessionId: undefined,
      startedAt: undefined,
      swingCount: 0,
    });
  }, []);

  const updateContext = useCallback((updates: Partial<FullSessionContext>) => {
    setContext((prev) => ({ ...prev, ...updates }));
  }, []);

  return {
    context,
    setEnvironment,
    setPitchSpeed,
    startSession,
    incrementSwingCount,
    resetContext,
    updateContext,
    // Derived state
    isReady: context.environment !== null,
    needsPitchSpeed: context.environment !== null && context.environment !== "tee",
  };
}
