import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { Sparkles, CheckCircle2 } from "lucide-react";
import type { MotorProfile, MotorProfileType, ViewerTier } from "@/lib/unified-metrics-types";
import { cn } from "@/lib/utils";

const MOTOR_PROFILE_TOOLTIP = "Your Motor Profile is your natural movement signature. We don't change it — we optimize it.";

interface MotorProfileCardProps {
  profile: MotorProfile;
  viewerTier: ViewerTier;
  className?: string;
}

const profileConfig: Record<MotorProfileType, { emoji: string; color: string; bgColor: string; label: string }> = {
  spinner: { emoji: '🌀', color: 'text-blue-400', bgColor: 'bg-blue-500/20', label: 'Spinner' },
  slingshotter: { emoji: '🏹', color: 'text-purple-400', bgColor: 'bg-purple-500/20', label: 'Slingshotter' },
  whipper: { emoji: '⚡', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', label: 'Whipper' },
  titan: { emoji: '🔨', color: 'text-red-400', bgColor: 'bg-red-500/20', label: 'Titan' },
};

const confidenceConfig = {
  confirmed: { label: 'CONFIRMED', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' },
  likely: { label: 'LIKELY', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
  hint: { label: 'HINT', color: 'text-slate-400', bgColor: 'bg-slate-500/20' },
};

function ProfileIcon({ 
  type, 
  isActive, 
  size = 'md' 
}: { 
  type: MotorProfileType; 
  isActive: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  const config = profileConfig[type];
  const sizeClasses = {
    sm: 'w-10 h-10 text-xl',
    md: 'w-14 h-14 text-2xl',
    lg: 'w-24 h-24 text-5xl',
  };
  
  return (
    <div 
      className={cn(
        "rounded-full flex items-center justify-center transition-all",
        sizeClasses[size],
        isActive ? cn(config.bgColor, "ring-2", config.color.replace('text-', 'ring-')) : "bg-slate-800/50 opacity-40"
      )}
    >
      <span className={isActive ? '' : 'grayscale'}>{config.emoji}</span>
    </div>
  );
}

export function MotorProfileCard({ profile, viewerTier, className }: MotorProfileCardProps) {
  if (!profile.present) {
    return (
      <Card className={cn("bg-slate-900 border-slate-800", className)}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-slate-200">
            <Sparkles className="h-5 w-5 text-purple-400" />
            Motor Profile
            <InfoTooltip content={MOTOR_PROFILE_TOOLTIP} />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">Motor profile analysis not available for this session.</p>
        </CardContent>
      </Card>
    );
  }

  const typeConfig = profileConfig[profile.suggested];
  const confConfig = confidenceConfig[profile.confidence];
  const showUpsell = profile.confidence !== 'confirmed' && viewerTier !== 'assessment';

  const headlineText = profile.confidence === 'confirmed' 
    ? `You ARE a ${typeConfig.label}` 
    : `You might be a ${typeConfig.label}`;

  // Add profile-specific glow/border styling
  const profileGlowClasses: Record<MotorProfileType, string> = {
    spinner: 'border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.15)]',
    slingshotter: 'border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.15)]',
    whipper: 'border-yellow-500/30 shadow-[0_0_15px_rgba(234,179,8,0.15)]',
    titan: 'border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.15)]',
  };

  return (
    <Card className={cn("bg-slate-900 border", profileGlowClasses[profile.suggested], className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-slate-200">
            <Sparkles className="h-5 w-5 text-purple-400" />
            Motor Profile
            <InfoTooltip content={MOTOR_PROFILE_TOOLTIP} />
          </CardTitle>
          <Badge 
            variant="outline" 
            className={cn("text-[10px] border-0 font-semibold", confConfig.bgColor, confConfig.color)}
          >
            {confConfig.label}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-5">
        {/* Main Profile Display */}
        <div className="flex items-center gap-4">
          <ProfileIcon type={profile.suggested} isActive={true} size="lg" />
          <div>
            <h3 className={cn("text-2xl font-bold", typeConfig.color)}>
              {headlineText}
            </h3>
            {profile.confidence === 'confirmed' && (
              <div className="flex items-center gap-1.5 text-emerald-400 text-sm mt-1">
                <CheckCircle2 className="h-4 w-4" />
                <span>Verified via 3D Analysis</span>
              </div>
            )}
          </div>
        </div>

        {/* Reasoning */}
        {profile.reasoning && (
          <p className="text-sm text-slate-300 leading-relaxed">
            {profile.reasoning}
          </p>
        )}

        {/* Characteristics */}
        {profile.characteristics && profile.characteristics.length > 0 && (
          <div className="space-y-2">
            <div className="text-[10px] text-slate-500 uppercase tracking-wide font-medium">
              Key Characteristics
            </div>
            <ul className="space-y-1.5">
              {profile.characteristics.map((char, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-400">
                  <span className={cn("mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0", typeConfig.bgColor.replace('/20', ''))} />
                  {char}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Upsell */}
        {showUpsell && (
          <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-lg p-4 border border-purple-500/20">
            <div className="text-sm font-medium text-slate-200 mb-2">
              Want to CONFIRM your Motor Profile?
            </div>
            <div className="text-xs text-slate-400 mb-3">
              Get definitive classification with our 3D motion capture assessment
            </div>
            <Button 
              size="sm" 
              className="bg-purple-600 hover:bg-purple-700 text-white text-xs"
            >
              Book 3D Assessment — $299
            </Button>
          </div>
        )}

        {/* All Profiles Footer */}
        <div className="pt-3 border-t border-slate-800">
          <div className="text-[10px] text-slate-600 text-center mb-3">All Motor Profiles</div>
          <div className="flex items-center justify-center gap-3">
            {(Object.keys(profileConfig) as MotorProfileType[]).map((type) => (
              <div key={type} className="flex flex-col items-center gap-1">
                <ProfileIcon 
                  type={type} 
                  isActive={type === profile.suggested} 
                  size="sm" 
                />
                <span className={cn(
                  "text-[9px] uppercase tracking-wide",
                  type === profile.suggested ? profileConfig[type].color : "text-slate-600"
                )}>
                  {profileConfig[type].label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default MotorProfileCard;
