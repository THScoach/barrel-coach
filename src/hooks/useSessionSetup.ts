/**
 * useSessionSetup - Hook to manage session setup context and persist to sensor_sessions
 * =======================================================================================
 * Stores environment and pitch speed context for dk-4b-inverse Ghost Stats calculation
 */

import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { HittingEnvironment, SessionContext } from "@/components/session/SessionSetupCard";

interface UseSessionSetupOptions {
  playerId?: string;
  onSessionCreated?: (sessionId: string) => void;
}

interface SessionSetupState {
  sessionId: string | null;
  context: SessionContext;
  isCreating: boolean;
  isReady: boolean;
}

export function useSessionSetup(options: UseSessionSetupOptions = {}) {
  const { playerId, onSessionCreated } = options;

  const [state, setState] = useState<SessionSetupState>({
    sessionId: null,
    context: {
      environment: null,
      estimatedPitchSpeed: null,
    },
    isCreating: false,
    isReady: false,
  });

  /**
   * Save context to an existing session
   */
  const updateSessionContext = useCallback(async (
    sessionId: string,
    context: SessionContext
  ) => {
    const { error } = await supabase
      .from("sensor_sessions")
      .update({
        environment: context.environment,
        estimated_pitch_speed: context.estimatedPitchSpeed,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    if (error) {
      console.error("[useSessionSetup] Failed to update session context:", error);
      toast.error("Failed to save session context");
      return false;
    }

    console.log(`[useSessionSetup] Updated session ${sessionId} with context:`, context);
    return true;
  }, []);

  /**
   * Create a new sensor session with context
   */
  const createSession = useCallback(async (context: SessionContext) => {
    if (!playerId) {
      toast.error("Player ID required to create session");
      return null;
    }

    setState(prev => ({ ...prev, isCreating: true }));

    try {
      const { data, error } = await supabase
        .from("sensor_sessions")
        .insert({
          player_id: playerId,
          environment: context.environment,
          estimated_pitch_speed: context.estimatedPitchSpeed,
          session_date: new Date().toISOString().split("T")[0],
          status: "active",
        })
        .select("id")
        .single();

      if (error) throw error;

      const sessionId = data.id;

      setState(prev => ({
        ...prev,
        sessionId,
        context,
        isCreating: false,
        isReady: true,
      }));

      console.log(`[useSessionSetup] Created session ${sessionId} with context:`, context);
      onSessionCreated?.(sessionId);

      return sessionId;
    } catch (err) {
      console.error("[useSessionSetup] Failed to create session:", err);
      toast.error("Failed to create session");
      setState(prev => ({ ...prev, isCreating: false }));
      return null;
    }
  }, [playerId, onSessionCreated]);

  /**
   * Complete session setup - creates session or updates existing
   */
  const completeSetup = useCallback(async (context: SessionContext) => {
    setState(prev => ({ ...prev, context }));

    if (state.sessionId) {
      // Update existing session
      const success = await updateSessionContext(state.sessionId, context);
      if (success) {
        setState(prev => ({ ...prev, isReady: true }));
      }
      return state.sessionId;
    } else {
      // Create new session
      return createSession(context);
    }
  }, [state.sessionId, updateSessionContext, createSession]);

  /**
   * Reset the session setup state
   */
  const reset = useCallback(() => {
    setState({
      sessionId: null,
      context: {
        environment: null,
        estimatedPitchSpeed: null,
      },
      isCreating: false,
      isReady: false,
    });
  }, []);

  /**
   * Attach context to an existing session ID
   */
  const attachToSession = useCallback((sessionId: string) => {
    setState(prev => ({ ...prev, sessionId }));
  }, []);

  return {
    // State
    sessionId: state.sessionId,
    context: state.context,
    isCreating: state.isCreating,
    isReady: state.isReady,

    // Actions
    completeSetup,
    updateSessionContext,
    createSession,
    attachToSession,
    reset,

    // Derived
    hasContext: state.context.environment !== null,
    needsPitchSpeed: state.context.environment !== null && state.context.environment !== "tee",
  };
}
