/**
 * SessionContextIntake - Unified component for capturing session context
 * ========================================================================
 * Captures environment (tee, front toss, machine, live pitch) and 
 * estimated pitch speed before sensor sessions start.
 * 
 * Used in: Ghost recovery, session setup, player portal, admin setup
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { 
  Circle, 
  Zap, 
  Settings2, 
  Flame,
  ChevronRight,
  CheckCircle2,
  Info
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ============================================================================
// TYPES
// ============================================================================

export type HittingEnvironment = "tee" | "front_toss" | "machine" | "live_pitch";

export interface SessionContextData {
  environment: HittingEnvironment | null;
  estimatedPitchSpeed: number | null;
}

export type SessionContextIntakeVariant = "card" | "inline" | "compact";

interface SessionContextIntakeProps {
  onSubmit?: (context: SessionContextData) => void;
  onChange?: (context: SessionContextData) => void;
  initialContext?: Partial<SessionContextData>;
  variant?: SessionContextIntakeVariant;
  showSubmitButton?: boolean;
  submitLabel?: string;
  isLoading?: boolean;
  className?: string;
  title?: string;
  description?: string;
}

// ============================================================================
// ENVIRONMENT CONFIG
// ============================================================================

const ENVIRONMENTS: {
  id: HittingEnvironment;
  label: string;
  shortLabel: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultSpeed: number | null;
}[] = [
  {
    id: "tee",
    label: "Tee Work",
    shortLabel: "Tee",
    description: "Hitting off the tee",
    icon: Circle,
    defaultSpeed: null,
  },
  {
    id: "front_toss",
    label: "Front Toss",
    shortLabel: "Front Toss",
    description: "Soft toss from the front",
    icon: Zap,
    defaultSpeed: 35,
  },
  {
    id: "machine",
    label: "Machine",
    shortLabel: "Machine",
    description: "Pitching machine",
    icon: Settings2,
    defaultSpeed: 65,
  },
  {
    id: "live_pitch",
    label: "Live Pitch",
    shortLabel: "Live",
    description: "Real pitcher throwing",
    icon: Flame,
    defaultSpeed: 75,
  },
];

const QUICK_SPEEDS = [45, 55, 65, 75, 85];

// ============================================================================
// HOOK FOR CONTEXT STATE
// ============================================================================

export function useSessionContext(initialContext?: Partial<SessionContextData>) {
  const [context, setContext] = useState<SessionContextData>({
    environment: initialContext?.environment ?? null,
    estimatedPitchSpeed: initialContext?.estimatedPitchSpeed ?? null,
  });

  const updateEnvironment = (env: HittingEnvironment) => {
    const envConfig = ENVIRONMENTS.find(e => e.id === env);
    setContext(prev => ({
      environment: env,
      // Auto-fill default speed, clear for tee
      estimatedPitchSpeed: env === "tee" 
        ? null 
        : (prev.estimatedPitchSpeed ?? envConfig?.defaultSpeed ?? null),
    }));
  };

  const updatePitchSpeed = (speed: number | null) => {
    setContext(prev => ({
      ...prev,
      estimatedPitchSpeed: speed,
    }));
  };

  const reset = () => {
    setContext({
      environment: null,
      estimatedPitchSpeed: null,
    });
  };

  const isValid = context.environment !== null;
  const showPitchSpeed = context.environment !== null && context.environment !== "tee";

  return {
    context,
    updateEnvironment,
    updatePitchSpeed,
    reset,
    isValid,
    showPitchSpeed,
  };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function SessionContextIntake({
  onSubmit,
  onChange,
  initialContext,
  variant = "card",
  showSubmitButton = true,
  submitLabel = "Continue",
  isLoading = false,
  className,
  title = "Session Context",
  description = "Tell us about your hitting session",
}: SessionContextIntakeProps) {
  const {
    context,
    updateEnvironment,
    updatePitchSpeed,
    isValid,
    showPitchSpeed,
  } = useSessionContext(initialContext);

  const [pitchSpeedInput, setPitchSpeedInput] = useState(
    initialContext?.estimatedPitchSpeed?.toString() || ""
  );

  // Notify parent of changes
  useEffect(() => {
    onChange?.(context);
  }, [context, onChange]);

  const handleEnvironmentSelect = (env: HittingEnvironment) => {
    updateEnvironment(env);
    
    // Auto-fill speed input
    const envConfig = ENVIRONMENTS.find(e => e.id === env);
    if (env === "tee") {
      setPitchSpeedInput("");
    } else if (envConfig?.defaultSpeed && !pitchSpeedInput) {
      setPitchSpeedInput(envConfig.defaultSpeed.toString());
    }
  };

  const handleSpeedChange = (value: string) => {
    const numericValue = value.replace(/\D/g, "").slice(0, 3);
    setPitchSpeedInput(numericValue);
    updatePitchSpeed(numericValue ? parseInt(numericValue, 10) : null);
  };

  const handleQuickSpeed = (speed: number) => {
    setPitchSpeedInput(speed.toString());
    updatePitchSpeed(speed);
  };

  const handleSubmit = () => {
    if (isValid && onSubmit) {
      onSubmit(context);
    }
  };

  // -------------------------------------------------------------------------
  // COMPACT VARIANT - Horizontal pills
  // -------------------------------------------------------------------------
  if (variant === "compact") {
    return (
      <div className={cn("space-y-3", className)}>
        {/* Environment Pills */}
        <div className="flex flex-wrap gap-2">
          {ENVIRONMENTS.map((env) => {
            const isSelected = context.environment === env.id;
            const Icon = env.icon;

            return (
              <button
                key={env.id}
                onClick={() => handleEnvironmentSelect(env.id)}
                disabled={isLoading}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all",
                  isSelected
                    ? "border-red-600 bg-red-600/10 text-white"
                    : "border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-white",
                  isLoading && "opacity-50 cursor-not-allowed"
                )}
              >
                <Icon className={cn("h-4 w-4", isSelected && "text-red-500")} />
                <span className="text-sm font-medium">{env.shortLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Pitch Speed - Inline */}
        {showPitchSpeed && (
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-[140px]">
              <Input
                type="text"
                inputMode="numeric"
                value={pitchSpeedInput}
                onChange={(e) => handleSpeedChange(e.target.value)}
                placeholder="Speed"
                disabled={isLoading}
                className="bg-slate-800 border-slate-700 text-white pr-12 h-10"
                maxLength={3}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
                mph
              </span>
            </div>
            <div className="flex gap-1">
              {QUICK_SPEEDS.slice(1, 4).map((speed) => (
                <button
                  key={speed}
                  onClick={() => handleQuickSpeed(speed)}
                  disabled={isLoading}
                  className={cn(
                    "px-2 py-1 rounded text-xs font-medium transition-colors",
                    pitchSpeedInput === speed.toString()
                      ? "bg-red-600 text-white"
                      : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                  )}
                >
                  {speed}
                </button>
              ))}
            </div>
          </div>
        )}

        {showSubmitButton && (
          <Button
            onClick={handleSubmit}
            disabled={!isValid || isLoading}
            size="sm"
            className="w-full bg-red-600 hover:bg-red-700 text-white"
          >
            {isLoading ? "Saving..." : submitLabel}
          </Button>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // INLINE VARIANT - Simple row layout
  // -------------------------------------------------------------------------
  if (variant === "inline") {
    return (
      <div className={cn("bg-slate-900/50 rounded-xl border border-slate-800 p-4", className)}>
        <div className="flex items-center gap-2 mb-3">
          <Settings2 className="h-4 w-4 text-red-500" />
          <span className="text-sm font-semibold text-white">{title}</span>
        </div>

        <div className="grid grid-cols-4 gap-2 mb-3">
          {ENVIRONMENTS.map((env) => {
            const isSelected = context.environment === env.id;
            const Icon = env.icon;

            return (
              <button
                key={env.id}
                onClick={() => handleEnvironmentSelect(env.id)}
                disabled={isLoading}
                className={cn(
                  "flex flex-col items-center p-3 rounded-lg border transition-all",
                  isSelected
                    ? "border-red-600 bg-red-600/10"
                    : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
                )}
              >
                <Icon className={cn("h-5 w-5 mb-1", isSelected ? "text-red-500" : "text-slate-400")} />
                <span className={cn("text-xs font-medium", isSelected ? "text-white" : "text-slate-400")}>
                  {env.shortLabel}
                </span>
              </button>
            );
          })}
        </div>

        {showPitchSpeed && (
          <div className="flex items-center gap-2 mb-3">
            <div className="relative flex-1">
              <Input
                type="text"
                inputMode="numeric"
                value={pitchSpeedInput}
                onChange={(e) => handleSpeedChange(e.target.value)}
                placeholder="Pitch speed"
                disabled={isLoading}
                className="bg-slate-800 border-slate-700 text-white pr-12"
                maxLength={3}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
                mph
              </span>
            </div>
            {QUICK_SPEEDS.map((speed) => (
              <button
                key={speed}
                onClick={() => handleQuickSpeed(speed)}
                disabled={isLoading}
                className={cn(
                  "px-2 py-2 rounded text-xs font-medium transition-colors min-w-[40px]",
                  pitchSpeedInput === speed.toString()
                    ? "bg-red-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                )}
              >
                {speed}
              </button>
            ))}
          </div>
        )}

        {context.environment === "tee" && (
          <p className="text-xs text-slate-500 mb-3">
            Tee work — no pitch speed needed
          </p>
        )}

        {showSubmitButton && (
          <Button
            onClick={handleSubmit}
            disabled={!isValid || isLoading}
            className="w-full bg-red-600 hover:bg-red-700 text-white"
          >
            {isLoading ? "Saving..." : submitLabel}
            {!isLoading && <ChevronRight className="h-4 w-4 ml-1" />}
          </Button>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // CARD VARIANT (Default) - Full card layout
  // -------------------------------------------------------------------------
  return (
    <TooltipProvider>
      <Card className={cn("bg-slate-900 border-slate-800", className)}>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-600/20 border border-red-600/30">
              <Settings2 className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-white">
                {title}
              </CardTitle>
              <p className="text-sm text-slate-400 mt-0.5">
                {description}
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Environment Selection */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium text-white">
                Where are you hitting?
              </Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-slate-500 cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top" className="bg-slate-800 border-slate-700 max-w-[200px]">
                  <p className="text-sm text-white">
                    This helps calculate your projected exit velocity and adjust analysis.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {ENVIRONMENTS.map((env) => {
                const isSelected = context.environment === env.id;
                const Icon = env.icon;

                return (
                  <button
                    key={env.id}
                    onClick={() => handleEnvironmentSelect(env.id)}
                    disabled={isLoading}
                    className={cn(
                      "relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-200",
                      "hover:scale-[1.02] active:scale-[0.98]",
                      isSelected
                        ? "border-red-600 bg-red-600/10 shadow-lg shadow-red-600/20"
                        : "border-slate-700 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800",
                      isLoading && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2">
                        <CheckCircle2 className="h-4 w-4 text-red-500" />
                      </div>
                    )}

                    <div
                      className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-colors",
                        isSelected ? "bg-red-600/20" : "bg-slate-700/50"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-6 w-6 transition-colors",
                          isSelected ? "text-red-500" : "text-slate-400"
                        )}
                      />
                    </div>

                    <span
                      className={cn(
                        "font-semibold text-sm transition-colors",
                        isSelected ? "text-white" : "text-slate-300"
                      )}
                    >
                      {env.label}
                    </span>

                    <span className="text-xs text-slate-500 mt-0.5">
                      {env.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Pitch Speed Input */}
          {showPitchSpeed && (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-2">
                <Label htmlFor="pitch-speed" className="text-sm font-medium text-white">
                  Estimated Pitch Speed
                </Label>
                <Badge variant="outline" className="border-slate-600 text-slate-400 text-xs">
                  Optional
                </Badge>
              </div>

              <div className="relative">
                <Input
                  id="pitch-speed"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={pitchSpeedInput}
                  onChange={(e) => handleSpeedChange(e.target.value)}
                  placeholder="Enter speed"
                  disabled={isLoading}
                  className={cn(
                    "bg-slate-800 border-slate-700 text-white placeholder:text-slate-500",
                    "pr-14 text-lg font-semibold",
                    "focus:border-red-600 focus:ring-red-600/20"
                  )}
                  maxLength={3}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">
                  MPH
                </div>
              </div>

              {/* Speed quick-select */}
              <div className="flex flex-wrap gap-2">
                {QUICK_SPEEDS.map((speed) => (
                  <button
                    key={speed}
                    onClick={() => handleQuickSpeed(speed)}
                    disabled={isLoading}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                      pitchSpeedInput === speed.toString()
                        ? "bg-red-600 text-white"
                        : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
                    )}
                  >
                    {speed} mph
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tee mode message */}
          {context.environment === "tee" && (
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
              <p className="text-sm text-slate-400">
                <span className="text-white font-medium">Tee work</span> — 
                Focus on your mechanics. No pitch speed needed.
              </p>
            </div>
          )}

          {/* Submit Button */}
          {showSubmitButton && (
            <Button
              onClick={handleSubmit}
              disabled={!isValid || isLoading}
              className={cn(
                "w-full h-12 text-base font-semibold transition-all",
                isValid && !isLoading
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-slate-800 text-slate-500 cursor-not-allowed"
              )}
            >
              {isLoading ? (
                "Saving..."
              ) : isValid ? (
                <>
                  {submitLabel}
                  <ChevronRight className="h-5 w-5 ml-2" />
                </>
              ) : (
                "Select an environment to continue"
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
