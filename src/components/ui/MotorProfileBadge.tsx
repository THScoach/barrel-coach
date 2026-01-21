/**
 * Motor Profile Badge Component
 * Human 3.0 styled badge displaying player's kinetic classification
 */
import { cn } from "@/lib/utils";
import { Zap, RotateCw, Waves, Flame, HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type MotorProfile = "SPINNER" | "WHIPPER" | "SLINGSHOTTER" | "TITAN" | "UNKNOWN" | string;

// Profile descriptions aligned with Human 3.0 philosophy
export const MOTOR_PROFILE_INFO: Record<string, {
  title: string;
  subtitle: string;
  description: string;
  characteristics: string[];
  trainingFocus: string;
  color: string;
}> = {
  SPINNER: {
    title: 'SPINNER',
    subtitle: 'Rotational Dominant',
    description: 'Quick-twitch athlete with tight timing gap. Generates power through rapid rotation rather than sequential load.',
    characteristics: [
      'High pelvis-to-torso velocity ratio',
      'Compact swing path',
      'Quick hands through the zone',
      'Thrives on inside pitches'
    ],
    trainingFocus: 'Maintain rotation speed while improving sequential separation for more power potential.',
    color: '#8b5cf6'
  },
  WHIPPER: {
    title: 'WHIPPER',
    subtitle: 'Elastic Sequential',
    description: 'Optimal separation athlete who stores and releases elastic energy efficiently. The gold standard for kinetic sequencing.',
    characteristics: [
      'High transfer efficiency (18-25%)',
      'Delayed bat delivery',
      'Excellent hip-shoulder separation',
      'Consistent barrel accuracy'
    ],
    trainingFocus: 'Refine timing consistency and maintain the elastic stretch through varied pitch speeds.',
    color: '#3b82f6'
  },
  SLINGSHOTTER: {
    title: 'SLINGSHOTTER',
    subtitle: 'Ground Force Dominant',
    description: 'Deep loader with late energy peak. Generates tremendous force from the ground up with extended coil.',
    characteristics: [
      'Extended timing gap (20%+)',
      'Strong ground flow score',
      'Deep hip load',
      'Late peak velocity'
    ],
    trainingFocus: 'Speed up the transfer without losing the deep load. Train faster unwind with maintained separation.',
    color: '#22c55e'
  },
  TITAN: {
    title: 'TITAN',
    subtitle: 'Raw Power',
    description: 'Elite bat kinetic energy with room for efficiency gains. Brute force athlete who could unlock another level with better sequencing.',
    characteristics: [
      'High bat KE and composite score',
      'Average transfer efficiency',
      'Raw exit velocity potential',
      'Variable timing patterns'
    ],
    trainingFocus: 'Channel the raw power through better kinetic sequencing. Small efficiency gains = big results.',
    color: '#f97316'
  },
  UNKNOWN: {
    title: 'UNKNOWN',
    subtitle: 'Awaiting Analysis',
    description: 'Not enough data to classify motor profile. Complete more sessions for accurate classification.',
    characteristics: [
      'Needs more swing data',
      'Profile will emerge with practice'
    ],
    trainingFocus: 'Focus on fundamentals while we gather data to identify your unique kinetic fingerprint.',
    color: '#64748b'
  }
};

const PROFILE_ICONS: Record<string, React.ElementType> = {
  SPINNER: RotateCw,
  WHIPPER: Waves,
  SLINGSHOTTER: Zap,
  TITAN: Flame,
  UNKNOWN: HelpCircle,
};

interface MotorProfileBadgeProps {
  profile: MotorProfile;
  confidence?: 'high' | 'medium' | 'low';
  size?: "sm" | "md" | "lg";
  showTooltip?: boolean;
  className?: string;
}

const SIZE_CONFIG = {
  sm: {
    badge: 'px-2 py-0.5 text-xs gap-1',
    icon: 'h-3 w-3',
  },
  md: {
    badge: 'px-3 py-1.5 text-sm gap-1.5',
    icon: 'h-4 w-4',
  },
  lg: {
    badge: 'px-4 py-2 text-base gap-2',
    icon: 'h-5 w-5',
  },
};

export function MotorProfileBadge({
  profile,
  confidence = 'high',
  size = "md",
  showTooltip = true,
  className,
}: MotorProfileBadgeProps) {
  const normalizedProfile = profile?.toUpperCase() || 'UNKNOWN';
  const info = MOTOR_PROFILE_INFO[normalizedProfile] || MOTOR_PROFILE_INFO.UNKNOWN;
  const Icon = PROFILE_ICONS[normalizedProfile] || PROFILE_ICONS.UNKNOWN;
  const sizeConfig = SIZE_CONFIG[size];

  const badge = (
    <div
      className={cn(
        "inline-flex items-center font-bold uppercase tracking-wider rounded-lg border-2",
        sizeConfig.badge,
        confidence === 'low' && "opacity-70",
        className
      )}
      style={{
        backgroundColor: `${info.color}20`,
        borderColor: `${info.color}80`,
        color: info.color,
        boxShadow: `0 0 20px ${info.color}30`,
      }}
    >
      <Icon className={sizeConfig.icon} />
      <span>PROFILE: {info.title}</span>
    </div>
  );

  if (!showTooltip) return badge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent 
          className="max-w-xs p-4 bg-slate-900 border-slate-700"
          style={{ borderColor: `${info.color}40` }}
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Icon className="h-5 w-5" style={{ color: info.color }} />
              <span className="font-bold text-white">{info.title}</span>
              <span className="text-xs text-slate-400">({info.subtitle})</span>
            </div>
            <p className="text-sm text-slate-300">{info.description}</p>
            <div className="pt-2 border-t border-slate-700">
              <p className="text-xs text-slate-400">
                <span className="font-semibold" style={{ color: info.color }}>Training Focus:</span>{' '}
                {info.trainingFocus}
              </p>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Large hero-style Motor Profile display
 */
interface MotorProfileHeroProps {
  profile: MotorProfile;
  confidence?: 'high' | 'medium' | 'low';
  reasoning?: string;
  className?: string;
}

export function MotorProfileHero({
  profile,
  confidence = 'high',
  reasoning,
  className,
}: MotorProfileHeroProps) {
  const normalizedProfile = profile?.toUpperCase() || 'UNKNOWN';
  const info = MOTOR_PROFILE_INFO[normalizedProfile] || MOTOR_PROFILE_INFO.UNKNOWN;
  const Icon = PROFILE_ICONS[normalizedProfile] || PROFILE_ICONS.UNKNOWN;

  return (
    <div
      className={cn(
        "relative rounded-xl border-2 p-6 overflow-hidden",
        className
      )}
      style={{
        backgroundColor: "#111113",
        borderColor: "#DC2626",
        boxShadow: "0 0 30px rgba(220, 38, 38, 0.2)",
      }}
    >
      {/* Background glow */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          background: `radial-gradient(circle at 30% 50%, ${info.color}, transparent 70%)`,
        }}
      />

      <div className="relative z-10 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div
            className="p-3 rounded-xl"
            style={{ backgroundColor: `${info.color}20` }}
          >
            <Icon className="h-8 w-8" style={{ color: info.color }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold uppercase tracking-wider text-[#DC2626]">
                Motor Profile
              </span>
              {confidence !== 'high' && (
                <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-400">
                  {confidence} confidence
                </span>
              )}
            </div>
            <h3 className="text-2xl font-black text-white">
              {info.title}
            </h3>
            <p className="text-sm text-slate-400">{info.subtitle}</p>
          </div>
        </div>

        {/* Description */}
        <p className="text-slate-300 leading-relaxed">
          {info.description}
        </p>

        {/* Reasoning */}
        {reasoning && (
          <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Classification Reasoning
            </p>
            <p className="text-sm text-slate-300">{reasoning}</p>
          </div>
        )}

        {/* Characteristics */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Key Characteristics
          </p>
          <div className="flex flex-wrap gap-2">
            {info.characteristics.map((char, i) => (
              <span
                key={i}
                className="text-xs px-2 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700"
              >
                {char}
              </span>
            ))}
          </div>
        </div>

        {/* Training Focus */}
        <div 
          className="p-4 rounded-lg border"
          style={{ 
            backgroundColor: `${info.color}10`,
            borderColor: `${info.color}40`,
          }}
        >
          <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: info.color }}>
            Training Focus
          </p>
          <p className="text-sm text-slate-200">
            {info.trainingFocus}
          </p>
        </div>
      </div>
    </div>
  );
}

export function getMotorProfileDescription(profile: MotorProfile): string {
  const normalizedProfile = profile?.toUpperCase() || 'UNKNOWN';
  return MOTOR_PROFILE_INFO[normalizedProfile]?.description || "Unknown profile";
}
