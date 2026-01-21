import { useState } from "react";
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
  Info
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Environment types
export type HittingEnvironment = "tee" | "front_toss" | "machine" | "live_pitch";

export interface SessionContext {
  environment: HittingEnvironment | null;
  estimatedPitchSpeed: number | null;
}

interface SessionSetupCardProps {
  onComplete?: (context: SessionContext) => void;
  initialContext?: Partial<SessionContext>;
  className?: string;
}

// Environment options with 8th-grade friendly labels
const environments: {
  id: HittingEnvironment;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultSpeed: number | null;
}[] = [
  {
    id: "tee",
    label: "Tee",
    description: "Hitting off the tee",
    icon: Circle,
    defaultSpeed: null, // No pitch speed for tee
  },
  {
    id: "front_toss",
    label: "Front Toss",
    description: "Soft toss from the front",
    icon: Zap,
    defaultSpeed: 35,
  },
  {
    id: "machine",
    label: "Machine",
    description: "Pitching machine",
    icon: Settings2,
    defaultSpeed: 65,
  },
  {
    id: "live_pitch",
    label: "Live Pitch",
    description: "Real pitcher throwing",
    icon: Flame,
    defaultSpeed: 75,
  },
];

export function SessionSetupCard({ 
  onComplete, 
  initialContext,
  className 
}: SessionSetupCardProps) {
  const [selectedEnvironment, setSelectedEnvironment] = useState<HittingEnvironment | null>(
    initialContext?.environment || null
  );
  const [pitchSpeed, setPitchSpeed] = useState<string>(
    initialContext?.estimatedPitchSpeed?.toString() || ""
  );

  const handleEnvironmentSelect = (env: HittingEnvironment) => {
    setSelectedEnvironment(env);
    
    // Auto-fill default speed for the environment
    const envConfig = environments.find(e => e.id === env);
    if (envConfig?.defaultSpeed && !pitchSpeed) {
      setPitchSpeed(envConfig.defaultSpeed.toString());
    }
    
    // Clear speed for tee
    if (env === "tee") {
      setPitchSpeed("");
    }
  };

  const handleSpeedChange = (value: string) => {
    // Only allow numbers and limit to 3 digits
    const numericValue = value.replace(/\D/g, "").slice(0, 3);
    setPitchSpeed(numericValue);
  };

  const handleContinue = () => {
    if (selectedEnvironment && onComplete) {
      onComplete({
        environment: selectedEnvironment,
        estimatedPitchSpeed: pitchSpeed ? parseInt(pitchSpeed, 10) : null,
      });
    }
  };

  const showSpeedInput = selectedEnvironment && selectedEnvironment !== "tee";
  const isValid = selectedEnvironment !== null;

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
                Session Setup
              </CardTitle>
              <p className="text-sm text-slate-400 mt-0.5">
                Tell us about your hitting session
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
                    This helps us understand your swing context and adjust analysis accordingly.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {environments.map((env) => {
                const isSelected = selectedEnvironment === env.id;
                const Icon = env.icon;

                return (
                  <button
                    key={env.id}
                    onClick={() => handleEnvironmentSelect(env.id)}
                    className={cn(
                      "relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-200",
                      "hover:scale-[1.02] active:scale-[0.98]",
                      isSelected
                        ? "border-red-600 bg-red-600/10 shadow-lg shadow-red-600/20"
                        : "border-slate-700 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800"
                    )}
                  >
                    {/* Selected indicator */}
                    {isSelected && (
                      <div className="absolute top-2 right-2">
                        <div className="w-3 h-3 rounded-full bg-red-600 animate-pulse" />
                      </div>
                    )}

                    <div
                      className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-colors",
                        isSelected
                          ? "bg-red-600/20"
                          : "bg-slate-700/50"
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
          {showSpeedInput && (
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
                  value={pitchSpeed}
                  onChange={(e) => handleSpeedChange(e.target.value)}
                  placeholder="Enter speed"
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

              {/* Speed reference badges */}
              <div className="flex flex-wrap gap-2">
                {[45, 55, 65, 75, 85].map((speed) => (
                  <button
                    key={speed}
                    onClick={() => setPitchSpeed(speed.toString())}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                      pitchSpeed === speed.toString()
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

          {/* Tee mode - no speed needed */}
          {selectedEnvironment === "tee" && (
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
              <p className="text-sm text-slate-400">
                <span className="text-white font-medium">Tee work</span> — 
                Focus on your mechanics. No pitch speed needed.
              </p>
            </div>
          )}

          {/* Continue Button */}
          <Button
            onClick={handleContinue}
            disabled={!isValid}
            className={cn(
              "w-full h-12 text-base font-semibold transition-all",
              isValid
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-slate-800 text-slate-500 cursor-not-allowed"
            )}
          >
            {isValid ? (
              <>
                Continue to Recording
                <ChevronRight className="h-5 w-5 ml-2" />
              </>
            ) : (
              "Select an option to continue"
            )}
          </Button>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

// Compact inline version for quick selection
export function SessionEnvironmentPicker({
  value,
  onChange,
  className,
}: {
  value: HittingEnvironment | null;
  onChange: (env: HittingEnvironment) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-2", className)}>
      {environments.map((env) => {
        const isSelected = value === env.id;
        const Icon = env.icon;

        return (
          <button
            key={env.id}
            onClick={() => onChange(env.id)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all",
              isSelected
                ? "border-red-600 bg-red-600/10 text-white"
                : "border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600"
            )}
          >
            <Icon className={cn("h-4 w-4", isSelected && "text-red-500")} />
            <span className="text-sm font-medium">{env.label}</span>
          </button>
        );
      })}
    </div>
  );
}
