/**
 * Prescription Card - Recommended Fix Based on Detected Leak
 * ==========================================================
 * Links detected leak to drills table's why_it_works field
 * Dark #0A0A0B with #DC2626 accents
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Pill, 
  Play, 
  ExternalLink, 
  CheckCircle2,
  ArrowRight,
  Dumbbell
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PrescriptionCardProps {
  drillName: string | null;
  whyItWorks: string | null;
  leakType: string | null;
  drillSets?: number | null;
  drillReps?: number | null;
  drillVideoUrl?: string | null;
  onViewDrill?: () => void;
  onAssignDrill?: () => void;
  isLoading?: boolean;
}

export function PrescriptionCard({
  drillName,
  whyItWorks,
  leakType,
  drillSets,
  drillReps,
  drillVideoUrl,
  onViewDrill,
  onAssignDrill,
  isLoading = false,
}: PrescriptionCardProps) {
  if (isLoading) {
    return (
      <Card className="bg-[#0A0A0B] border-[#1a1a1c]">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-slate-800 rounded w-1/3" />
            <div className="h-24 bg-slate-800 rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!drillName) {
    return (
      <Card className="bg-[#0A0A0B] border-[#1a1a1c] border-l-4 border-l-slate-700">
        <CardContent className="p-6 text-center">
          <Dumbbell className="h-8 w-8 text-slate-600 mx-auto mb-2" />
          <p className="text-slate-500 text-sm">No prescription available</p>
          <p className="text-slate-600 text-xs mt-1">Run diagnostics to generate recommendations</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      className="bg-[#0A0A0B] border-[#1a1a1c] border-l-4 border-l-emerald-500 overflow-hidden relative"
      style={{
        boxShadow: '0 0 30px rgba(16, 185, 129, 0.1)',
      }}
    >
      {/* Subtle gradient glow */}
      <div 
        className="absolute top-0 left-0 right-0 h-16 pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, rgba(16, 185, 129, 0.05), transparent)',
        }}
      />
      
      <CardHeader className="pb-3 relative">
        <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-500">
          <Pill className="h-4 w-4" />
          TRAINING PRESCRIPTION
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4 relative">
        {/* Connection to Leak */}
        {leakType && (
          <div className="flex items-center gap-2 text-xs">
            <Badge className="bg-[#DC2626]/20 text-[#DC2626] border-[#DC2626]/30">
              {leakType.replace(/_/g, ' ').toUpperCase()}
            </Badge>
            <ArrowRight className="h-3 w-3 text-slate-500" />
            <span className="text-slate-400">Recommended Fix</span>
          </div>
        )}

        {/* Drill Info */}
        <div className="bg-[#111113] rounded-lg p-4 border border-[#1a1a1c]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h4 className="text-lg font-bold text-white mb-1">
                {drillName}
              </h4>
              
              {/* Sets & Reps */}
              {(drillSets || drillReps) && (
                <div className="flex items-center gap-3 mb-3">
                  {drillSets && (
                    <Badge variant="outline" className="border-slate-700 text-slate-400 text-xs">
                      {drillSets} Sets
                    </Badge>
                  )}
                  {drillReps && (
                    <Badge variant="outline" className="border-slate-700 text-slate-400 text-xs">
                      {drillReps} Reps
                    </Badge>
                  )}
                </div>
              )}
              
              {/* Why It Works */}
              {whyItWorks && (
                <div className="mt-3 pt-3 border-t border-[#1a1a1c]">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    <span className="text-xs font-semibold text-emerald-500 uppercase tracking-wide">
                      Why It Works
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    {whyItWorks}
                  </p>
                </div>
              )}
            </div>

            {/* Video Preview Placeholder */}
            {drillVideoUrl && (
              <div 
                className="w-24 h-16 bg-slate-800 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-700 transition-colors flex-shrink-0"
                onClick={onViewDrill}
              >
                <Play className="h-6 w-6 text-slate-400" />
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            onClick={onAssignDrill}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Assign to Player
          </Button>
          
          {drillVideoUrl && (
            <Button
              variant="outline"
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
              onClick={onViewDrill}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
