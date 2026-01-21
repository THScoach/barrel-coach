/**
 * Kinetic Leak Card - High-End Diagnostic Alert
 * ==============================================
 * Surfaces leak_evidence and weakest_link from database
 * Dark #0A0A0B with glowing #DC2626 red border
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Activity, Brain, Zap, Target, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

interface KineticLeakCardProps {
  leakType: string | null;
  leakEvidence: string | null;
  weakestLink: string | null;
  motorProfile?: string | null;
  isLoading?: boolean;
}

const leakConfig: Record<string, { 
  label: string; 
  icon: typeof AlertTriangle; 
  color: string;
  bgColor: string;
}> = {
  late_legs: {
    label: 'Late Legs',
    icon: Activity,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
  },
  early_arms: {
    label: 'Early Arms',
    icon: Zap,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
  },
  torso_bypass: {
    label: 'Torso Bypass',
    icon: Flame,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
  },
  arm_bar: {
    label: 'Arm Bar',
    icon: Zap,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
  },
  brain: {
    label: 'Pattern Recognition',
    icon: Brain,
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/10',
  },
  body: {
    label: 'Energy Production',
    icon: Activity,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
  },
  bat: {
    label: 'Energy Delivery',
    icon: Zap,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
  },
  ball: {
    label: 'Output Quality',
    icon: Target,
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
  },
};

export function KineticLeakCard({
  leakType,
  leakEvidence,
  weakestLink,
  motorProfile,
  isLoading = false,
}: KineticLeakCardProps) {
  if (isLoading) {
    return (
      <Card className="bg-[#0A0A0B] border-[#1a1a1c]">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-slate-800 rounded w-1/3" />
            <div className="h-20 bg-slate-800 rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!leakType && !weakestLink && !leakEvidence) {
    return (
      <Card className="bg-[#0A0A0B] border-[#1a1a1c] border-l-4 border-l-slate-700">
        <CardContent className="p-6 text-center">
          <p className="text-slate-500 text-sm">No kinetic leak detected yet</p>
          <p className="text-slate-600 text-xs mt-1">Upload session data to run diagnostics</p>
        </CardContent>
      </Card>
    );
  }

  const normalizedType = (leakType || weakestLink || '').toLowerCase().replace(/\s+/g, '_');
  const config = leakConfig[normalizedType] || {
    label: leakType || weakestLink || 'Unknown',
    icon: AlertTriangle,
    color: 'text-[#DC2626]',
    bgColor: 'bg-[#DC2626]/10',
  };
  const Icon = config.icon;

  return (
    <Card 
      className="bg-[#0A0A0B] border-[#1a1a1c] border-l-4 border-l-[#DC2626] overflow-hidden relative"
      style={{
        boxShadow: '0 0 30px rgba(220, 38, 38, 0.15), inset 0 0 60px rgba(220, 38, 38, 0.03)',
      }}
    >
      {/* Subtle glow effect at top */}
      <div 
        className="absolute top-0 left-0 right-0 h-16 pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, rgba(220, 38, 38, 0.08), transparent)',
        }}
      />
      
      <CardHeader className="pb-3 relative">
        <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#DC2626]">
          <AlertTriangle className="h-4 w-4" />
          KINETIC LEAK WARNING
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4 relative">
        {/* Primary Leak Badge */}
        <div className="flex items-start gap-4">
          <div className={cn(
            "p-3 rounded-xl flex-shrink-0",
            config.bgColor
          )}>
            <Icon className={cn("h-6 w-6", config.color)} />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <Badge 
                className={cn(
                  "px-3 py-1 text-xs font-bold uppercase tracking-wider",
                  config.bgColor,
                  config.color
                )}
              >
                {config.label}
              </Badge>
              
              {motorProfile && (
                <Badge 
                  variant="outline" 
                  className="text-xs border-slate-700 text-slate-400"
                >
                  {motorProfile}
                </Badge>
              )}
            </div>
            
            {/* Leak Evidence */}
            {leakEvidence && (
              <p className="text-sm text-slate-300 leading-relaxed">
                {leakEvidence}
              </p>
            )}
          </div>
        </div>

        {/* Weakest Link Callout */}
        {weakestLink && weakestLink.toLowerCase() !== normalizedType && (
          <div className="flex items-center gap-3 p-3 bg-[#111113] rounded-lg border border-[#1a1a1c]">
            <span className="text-xs text-slate-500 uppercase tracking-wide">
              Weakest Link:
            </span>
            <Badge className="bg-[#DC2626]/20 text-[#DC2626] border-[#DC2626]/30">
              {weakestLink.toUpperCase()}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
