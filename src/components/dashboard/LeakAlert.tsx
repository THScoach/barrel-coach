import { AlertTriangle, CheckCircle, HelpCircle, RotateCcw, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

type LeakType = 'clean_transfer' | 'late_legs' | 'early_arms' | 'torso_bypass' | 'no_bat_delivery' | 'unknown';

interface LeakAlertProps {
  type: LeakType | string | null;
  caption: string | null;
  training: string | null;
}

const leakConfig: Record<LeakType, { icon: typeof AlertTriangle; color: string; bgColor: string; label: string }> = {
  clean_transfer: {
    icon: CheckCircle,
    color: "text-green-500",
    bgColor: "bg-green-500/20",
    label: "Clean Transfer"
  },
  late_legs: {
    icon: Zap,
    color: "text-red-500",
    bgColor: "bg-red-500/20",
    label: "Late Legs"
  },
  early_arms: {
    icon: Zap,
    color: "text-orange-500",
    bgColor: "bg-orange-500/20",
    label: "Early Arms"
  },
  torso_bypass: {
    icon: RotateCcw,
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/20",
    label: "Torso Bypass"
  },
  no_bat_delivery: {
    icon: AlertTriangle,
    color: "text-red-500",
    bgColor: "bg-red-500/20",
    label: "No Bat Delivery"
  },
  unknown: {
    icon: HelpCircle,
    color: "text-gray-400",
    bgColor: "bg-gray-500/20",
    label: "Unknown"
  }
};

export function LeakAlert({ type, caption, training }: LeakAlertProps) {
  if (!type && !caption) return null;

  const leakType = (type as LeakType) || 'unknown';
  const config = leakConfig[leakType] || leakConfig.unknown;
  const Icon = config.icon;
  const isClean = leakType === 'clean_transfer';

  return (
    <div
      className={cn(
        "bg-[#1F2937] rounded-lg p-5 border-l-4",
        isClean ? "border-green-500" : "border-[#DC2626]"
      )}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={cn("p-2 rounded-full flex-shrink-0", config.bgColor)}>
          <Icon className={cn("h-5 w-5", config.color)} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Type Badge */}
          <span className={cn(
            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mb-2",
            config.bgColor,
            config.color
          )}>
            {config.label}
          </span>

          {/* Caption */}
          {caption && (
            <p className="text-lg text-white font-medium mb-2">
              {caption}
            </p>
          )}

          {/* Training Recommendation */}
          {training && (
            <p className="text-sm text-gray-400 italic">
              {training}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
