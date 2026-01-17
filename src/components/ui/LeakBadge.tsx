import { cn } from "@/lib/utils";

type LeakType = 
  | "EARLY_ARMS"
  | "CAST"
  | "LUNGE"
  | "COLLAPSE"
  | "DISCONNECTION"
  | "SPIN_OUT"
  | "POOR_SEPARATION"
  | "ENERGY_LEAK"
  | "CLEAN_TRANSFER"
  | string;

interface LeakBadgeProps {
  leak: LeakType;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  className?: string;
}

const leakConfig: Record<string, { bg: string; text: string; severity: "clean" | "warning" | "critical"; label: string }> = {
  CLEAN_TRANSFER: {
    bg: "bg-green-500/20 border-green-500/50",
    text: "text-green-400",
    severity: "clean",
    label: "Clean Transfer",
  },
  EARLY_ARMS: {
    bg: "bg-red-500/20 border-red-500/50",
    text: "text-red-400",
    severity: "critical",
    label: "Early Arms",
  },
  CAST: {
    bg: "bg-orange-500/20 border-orange-500/50",
    text: "text-orange-400",
    severity: "warning",
    label: "Cast",
  },
  LUNGE: {
    bg: "bg-red-500/20 border-red-500/50",
    text: "text-red-400",
    severity: "critical",
    label: "Lunge",
  },
  COLLAPSE: {
    bg: "bg-red-500/20 border-red-500/50",
    text: "text-red-400",
    severity: "critical",
    label: "Collapse",
  },
  DISCONNECTION: {
    bg: "bg-orange-500/20 border-orange-500/50",
    text: "text-orange-400",
    severity: "warning",
    label: "Disconnection",
  },
  SPIN_OUT: {
    bg: "bg-orange-500/20 border-orange-500/50",
    text: "text-orange-400",
    severity: "warning",
    label: "Spin Out",
  },
  POOR_SEPARATION: {
    bg: "bg-orange-500/20 border-orange-500/50",
    text: "text-orange-400",
    severity: "warning",
    label: "Poor Separation",
  },
  ENERGY_LEAK: {
    bg: "bg-red-500/20 border-red-500/50",
    text: "text-red-400",
    severity: "critical",
    label: "Energy Leak",
  },
};

export function LeakBadge({ leak, size = "md", className }: LeakBadgeProps) {
  const config = leakConfig[leak] || {
    bg: "bg-slate-500/20 border-slate-500/50",
    text: "text-slate-400",
    severity: "warning",
    label: leak?.replace(/_/g, " ") || "Unknown",
  };
  
  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-1 text-sm",
    lg: "px-3 py-1.5 text-base",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-medium rounded-md border",
        config.bg,
        config.text,
        sizeClasses[size],
        className
      )}
    >
      {config.label}
    </span>
  );
}

export function getLeakDescription(leak: LeakType): string {
  const descriptions: Record<string, string> = {
    EARLY_ARMS: "Arms fire with or before torso, killing the whip effect",
    CAST: "Hands drift away from body before hip turn, losing leverage",
    LUNGE: "Weight moves forward before rotation starts",
    COLLAPSE: "Front leg bends at contact instead of bracing",
    DISCONNECTION: "Torso working alone without lower body connection",
    SPIN_OUT: "Hips over-rotate, losing connection to ground",
    POOR_SEPARATION: "Not creating enough stretch between hips and shoulders",
    ENERGY_LEAK: "Energy dying in transition between segments",
    CLEAN_TRANSFER: "No major leaks detected - efficient energy transfer",
  };
  return descriptions[leak] || "Unknown leak pattern";
}
