import { cn } from "@/lib/utils";

type MotorProfile = "SPINNER" | "WHIPPER" | "SLINGSHOTTER" | "TITAN" | string;

interface MotorProfileBadgeProps {
  profile: MotorProfile;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const profileConfig: Record<string, { bg: string; text: string; description: string }> = {
  SPINNER: {
    bg: "bg-purple-500/20 border-purple-500/50",
    text: "text-purple-400",
    description: "Rotational dominant, quick-twitch",
  },
  WHIPPER: {
    bg: "bg-blue-500/20 border-blue-500/50",
    text: "text-blue-400",
    description: "Sequential fire, balanced",
  },
  SLINGSHOTTER: {
    bg: "bg-green-500/20 border-green-500/50",
    text: "text-green-400",
    description: "Ground force dominant, power-loaded",
  },
  TITAN: {
    bg: "bg-orange-500/20 border-orange-500/50",
    text: "text-orange-400",
    description: "Raw power focused, brute force",
  },
};

export function MotorProfileBadge({ profile, size = "md", className }: MotorProfileBadgeProps) {
  const config = profileConfig[profile] || profileConfig.WHIPPER;
  
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
      {profile}
    </span>
  );
}

export function getMotorProfileDescription(profile: MotorProfile): string {
  return profileConfig[profile]?.description || "Unknown profile";
}
