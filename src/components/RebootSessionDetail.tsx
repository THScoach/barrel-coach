import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Loader2, Trash2, Activity, Zap, Info, Target } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getGrade } from "@/lib/reboot-parser";
import { Json } from "@/integrations/supabase/types";

interface MEDataRow {
  legs_kinetic_energy?: number;
  torso_kinetic_energy?: number;
  arms_kinetic_energy?: number;
  larm_kinetic_energy?: number;
  rarm_kinetic_energy?: number;
  bat_kinetic_energy?: number;
  total_kinetic_energy?: number;
  lowerhalf_kinetic_energy?: number;
}

interface RebootUpload {
  id: string;
  session_date: string;
  player_id?: string | null;
  brain_score: number | null;
  body_score: number | null;
  bat_score: number | null;
  composite_score: number | null;
  grade: string | null;
  ground_flow_score: number | null;
  core_flow_score: number | null;
  upper_flow_score: number | null;
  pelvis_velocity: number | null;
  torso_velocity: number | null;
  x_factor: number | null;
  bat_ke: number | null;
  transfer_efficiency: number | null;
  consistency_cv: number | null;
  consistency_grade: string | null;
  weakest_link: string | null;
  ik_file_uploaded: boolean;
  me_file_uploaded: boolean;
  me_data?: Json | null;
}

interface RebootSessionDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: RebootUpload | null;
  onDelete: () => void;
}

// Kinetic Potential constants (LOCKED - DO NOT CHANGE)
const BASELINE_HEIGHT_INCHES = 68;
const KP_EFFICIENCY_SCALE = 1.4;
const KP_SPEED_MULTIPLIER = 2.5;

interface KineticPotential {
  massAdjustedEnergy: number;
  leverIndex: number;
  efficiency: number;
  estimatedCurrentBatSpeedMph: number;
  projectedBatSpeedCeilingMph: number;
  mphLeftOnTable: number;
  hasProjections: boolean;
  missingData: 'height_weight' | 'me_data' | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Extract peak KE values from ME data
function extractMEMetrics(meData: Json | null | undefined): {
  legsKE: number | null;
  torsoKE: number | null;
  armsKE: number | null;
  batKE: number | null;
  totalKE: number | null;
  legsToTorsoTransfer: number | null;
  torsoToArmsTransfer: number | null;
} {
  if (!meData || !Array.isArray(meData)) {
    return {
      legsKE: null,
      torsoKE: null,
      armsKE: null,
      batKE: null,
      totalKE: null,
      legsToTorsoTransfer: null,
      torsoToArmsTransfer: null,
    };
  }

  const rows = meData as MEDataRow[];
  
  // Calculate peak values across all frames
  let maxLegsKE = 0;
  let maxTorsoKE = 0;
  let maxArmsKE = 0;
  let maxBatKE = 0;
  let maxTotalKE = 0;

  for (const row of rows) {
    const legsKE = row.legs_kinetic_energy ?? row.lowerhalf_kinetic_energy ?? 0;
    const torsoKE = row.torso_kinetic_energy ?? 0;
    // Handle both combined arms_kinetic_energy and separate larm/rarm
    const armsKE = row.arms_kinetic_energy || 
      ((row.larm_kinetic_energy ?? 0) + (row.rarm_kinetic_energy ?? 0));
    const batKE = row.bat_kinetic_energy ?? 0;
    const totalKE = row.total_kinetic_energy ?? (legsKE + torsoKE + armsKE + batKE);

    maxLegsKE = Math.max(maxLegsKE, legsKE);
    maxTorsoKE = Math.max(maxTorsoKE, torsoKE);
    maxArmsKE = Math.max(maxArmsKE, armsKE);
    maxBatKE = Math.max(maxBatKE, batKE);
    maxTotalKE = Math.max(maxTotalKE, totalKE);
  }

  // Calculate transfer efficiencies
  const legsToTorsoTransfer = maxLegsKE > 0 ? Math.round((maxTorsoKE / maxLegsKE) * 100) : null;
  const torsoToArmsTransfer = maxTorsoKE > 0 ? Math.round((maxArmsKE / maxTorsoKE) * 100) : null;

  return {
    legsKE: maxLegsKE > 0 ? Math.round(maxLegsKE) : null,
    torsoKE: maxTorsoKE > 0 ? Math.round(maxTorsoKE) : null,
    armsKE: maxArmsKE > 0 ? Math.round(maxArmsKE) : null,
    batKE: maxBatKE > 0 ? Math.round(maxBatKE) : null,
    totalKE: maxTotalKE > 0 ? Math.round(maxTotalKE) : null,
    legsToTorsoTransfer,
    torsoToArmsTransfer,
  };
}

export function RebootSessionDetail({
  open,
  onOpenChange,
  session,
  onDelete
}: RebootSessionDetailProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [playerPhysicalData, setPlayerPhysicalData] = useState<{
    heightInches: number | null;
    weightLbs: number | null;
  } | null>(null);

  // Fetch player physical data for Kinetic Potential calculations
  useEffect(() => {
    async function fetchPlayerData() {
      if (!session?.player_id) {
        setPlayerPhysicalData(null);
        return;
      }

      const { data } = await supabase
        .from('players')
        .select('height_inches, weight_lbs')
        .eq('id', session.player_id)
        .maybeSingle();

      if (data) {
        setPlayerPhysicalData({
          heightInches: data.height_inches ? Number(data.height_inches) : null,
          weightLbs: data.weight_lbs ? Number(data.weight_lbs) : null,
        });
      } else {
        setPlayerPhysicalData(null);
      }
    }

    if (open && session) {
      fetchPlayerData();
    }
  }, [open, session?.player_id]);
  
  if (!session) return null;

  // Extract ME-based energy metrics
  const meMetrics = extractMEMetrics(session.me_data);

  // Calculate Kinetic Potential (formulas LOCKED - DO NOT CHANGE)
  const calculateKineticPotential = (): KineticPotential => {
    const heightInches = playerPhysicalData?.heightInches;
    const weightLbs = playerPhysicalData?.weightLbs;

    // Check for missing player data
    if (!heightInches || !weightLbs) {
      return {
        massAdjustedEnergy: 0,
        leverIndex: 0,
        efficiency: 0,
        estimatedCurrentBatSpeedMph: 0,
        projectedBatSpeedCeilingMph: 0,
        mphLeftOnTable: 0,
        hasProjections: false,
        missingData: 'height_weight',
      };
    }

    // Check for missing ME data
    if (!meMetrics.totalKE || !meMetrics.armsKE || meMetrics.totalKE <= 0 || meMetrics.armsKE <= 0) {
      return {
        massAdjustedEnergy: 0,
        leverIndex: 0,
        efficiency: 0,
        estimatedCurrentBatSpeedMph: 0,
        projectedBatSpeedCeilingMph: 0,
        mphLeftOnTable: 0,
        hasProjections: false,
        missingData: 'me_data',
      };
    }

    const bodyMassKg = weightLbs / 2.20462;
    const armsKEPeak = meMetrics.armsKE;
    const totalKEPeak = meMetrics.totalKE;

    // DERIVED METRICS (LOCKED FORMULAS)
    const leverIndex = heightInches / BASELINE_HEIGHT_INCHES;
    const massAdjustedEnergy = totalKEPeak / bodyMassKg;

    // Efficiency (0-1) - NO BAT SENSOR formula
    const rawEfficiency = (armsKEPeak / totalKEPeak) * KP_EFFICIENCY_SCALE;
    const efficiency = clamp(rawEfficiency, 0, 1);

    // CORE FORMULAS (LOCKED - DO NOT CHANGE)
    const projectedBatSpeedCeilingMph = KP_SPEED_MULTIPLIER * Math.sqrt(armsKEPeak) * leverIndex;
    const estimatedCurrentBatSpeedMph = projectedBatSpeedCeilingMph * efficiency;
    const mphLeftOnTable = Math.max(0, projectedBatSpeedCeilingMph - estimatedCurrentBatSpeedMph);

    return {
      massAdjustedEnergy,
      leverIndex,
      efficiency,
      estimatedCurrentBatSpeedMph,
      projectedBatSpeedCeilingMph,
      mphLeftOnTable,
      hasProjections: true,
      missingData: null,
    };
  };

  const kineticPotential = calculateKineticPotential();
  
  const getScoreColor = (score: number | null) => {
    if (score === null) return "text-muted-foreground";
    if (score >= 60) return "text-green-500";
    if (score >= 50) return "text-yellow-500";
    if (score >= 40) return "text-orange-500";
    return "text-red-500";
  };
  
  const getScoreBgColor = (score: number | null) => {
    if (score === null) return "bg-muted";
    if (score >= 60) return "bg-green-500";
    if (score >= 50) return "bg-yellow-500";
    if (score >= 40) return "bg-orange-500";
    return "bg-red-500";
  };
  
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };
  
  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this session?")) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("reboot_uploads")
        .delete()
        .eq("id", session.id);
      
      if (error) throw error;
      
      toast.success("Session deleted");
      onOpenChange(false);
      onDelete();
    } catch (error) {
      console.error("Error deleting session:", error);
      toast.error("Failed to delete session");
    } finally {
      setIsDeleting(false);
    }
  };

  // Format KE display with "Not Measured" fallback
  const formatKE = (value: number | null, isBat: boolean = false) => {
    if (value === null || value === 0) {
      if (isBat) return "Not Measured";
      return "--";
    }
    return `${value} J`;
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-purple-500" />
            Reboot Motion Session
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{formatDate(session.session_date)}</p>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Main Scores */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Brain', score: session.brain_score },
              { label: 'Body', score: session.body_score },
              { label: 'Bat', score: session.bat_score },
              { label: 'Composite', score: session.composite_score },
            ].map(({ label, score }) => (
              <div 
                key={label}
                className={`p-3 rounded-lg text-center text-white ${getScoreBgColor(score)}`}
              >
                <div className="text-xs opacity-90">{label}</div>
                <div className="text-2xl font-bold">{score ?? '--'}</div>
                <div className="text-xs opacity-90">
                  {score ? getGrade(score) : 'No data'}
                </div>
              </div>
            ))}
          </div>
          
          {/* Weakest Link */}
          {session.weakest_link && (
            <div className="text-center p-3 bg-muted rounded-lg">
              <span className="text-sm text-muted-foreground">Weakest Link: </span>
              <span className="font-medium capitalize">{session.weakest_link}</span>
            </div>
          )}
          
          {/* ENERGY TRANSFER (PRIMARY SECTION) - Momentum-Based */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-orange-500" />
              <h4 className="font-medium text-sm">ENERGY TRANSFER</h4>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="text-xs text-muted-foreground">Legs KE</div>
                <div className="text-lg font-bold">{formatKE(meMetrics.legsKE)}</div>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="text-xs text-muted-foreground">Torso KE</div>
                <div className="text-lg font-bold">{formatKE(meMetrics.torsoKE)}</div>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="text-xs text-muted-foreground">Arms KE</div>
                <div className="text-lg font-bold">{formatKE(meMetrics.armsKE)}</div>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="p-3 bg-muted/50 rounded-lg cursor-help">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        Bat KE
                        {(meMetrics.batKE === null || meMetrics.batKE === 0) && (
                          <Info className="h-3 w-3" />
                        )}
                      </div>
                      <div className="text-lg font-bold">{formatKE(meMetrics.batKE, true)}</div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Bat sensors not required for this analysis.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="p-3 bg-muted/30 rounded-lg text-center">
              <div className="text-xs text-muted-foreground">Total System Energy</div>
              <div className="text-xl font-bold">{formatKE(meMetrics.totalKE)}</div>
            </div>
          </div>

          {/* KINETIC POTENTIAL SECTION */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-emerald-500" />
              <h4 className="font-medium text-sm">KINETIC POTENTIAL</h4>
            </div>

            {kineticPotential.missingData === 'height_weight' ? (
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg text-center">
                <p className="text-sm text-amber-400">
                  Add height + weight to enable bat speed projection.
                </p>
              </div>
            ) : kineticPotential.missingData === 'me_data' ? (
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg text-center">
                <p className="text-sm text-amber-400">
                  Need more usable ME data to project bat speed.
                </p>
              </div>
            ) : (
              <>
                {/* Big 3 numbers */}
                <div className="grid grid-cols-3 gap-3">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-center cursor-help">
                          <div className="text-xs text-muted-foreground">Current (est.)</div>
                          <div className="text-2xl font-bold text-emerald-400">
                            {kineticPotential.estimatedCurrentBatSpeedMph.toFixed(1)}
                          </div>
                          <div className="text-xs text-emerald-400/80">mph</div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Estimate based on how much of your total energy actually makes it into your arms.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-center cursor-help">
                          <div className="text-xs text-muted-foreground">Ceiling</div>
                          <div className="text-2xl font-bold text-blue-400">
                            {kineticPotential.projectedBatSpeedCeilingMph.toFixed(1)}
                          </div>
                          <div className="text-xs text-blue-400/80">mph</div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Your best-case bat speed if you clean up leaks and deliver energy to the barrel.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg text-center">
                    <div className="text-xs text-muted-foreground">Left on table</div>
                    <div className="text-2xl font-bold text-orange-400">
                      {kineticPotential.mphLeftOnTable.toFixed(1)}
                    </div>
                    <div className="text-xs text-orange-400/80">mph</div>
                  </div>
                </div>

                {/* Support metrics line */}
                <div className="flex justify-center gap-4 text-xs text-muted-foreground">
                  <span>
                    Efficiency: <span className="font-medium text-foreground">{Math.round(kineticPotential.efficiency * 100)}%</span>
                  </span>
                  <span>
                    MAE: <span className="font-medium text-foreground">{kineticPotential.massAdjustedEnergy.toFixed(1)} J/kg</span>
                  </span>
                  <span>
                    Lever: <span className="font-medium text-foreground">{kineticPotential.leverIndex.toFixed(2)}</span>
                  </span>
                </div>

                {/* Coach voice helper text */}
                <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-lg">
                  <p className="text-xs text-muted-foreground text-center italic">
                    No bat sensor needed. This is what your engine says you should be able to swing — and how much speed you're not cashing in yet.
                  </p>
                </div>
              </>
            )}
          </div>

          {/* TRANSFER EFFICIENCY (SECONDARY) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground">TRANSFER EFFICIENCY</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Legs → Torso:</span>
                  <span className="font-medium">
                    {meMetrics.legsToTorsoTransfer !== null ? `${meMetrics.legsToTorsoTransfer}%` : '--'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Torso → Arms:</span>
                  <span className="font-medium">
                    {meMetrics.torsoToArmsTransfer !== null ? `${meMetrics.torsoToArmsTransfer}%` : '--'}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground">CONSISTENCY</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CV%:</span>
                  <span className="font-medium">{session.consistency_cv ?? '--'}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Grade:</span>
                  <span className="font-medium">{session.consistency_grade ?? '--'}</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* SUB-SCORES (Energy-Based) */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground">FLOW SUB-SCORES</h4>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Ground Flow', score: session.ground_flow_score, desc: 'Legs KE production' },
                { label: 'Core Flow', score: session.core_flow_score, desc: 'Legs → Torso transfer' },
                { label: 'Upper Flow', score: session.upper_flow_score, desc: 'Arms + delivery' },
              ].map(({ label, score, desc }) => (
                <TooltipProvider key={label}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="p-2 bg-muted rounded-lg text-center cursor-help">
                        <div className="text-xs text-muted-foreground">{label}</div>
                        <div className={`text-lg font-bold ${getScoreColor(score)}`}>
                          {score ?? '--'}
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{desc}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          </div>

          {/* Coach-Facing Language */}
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-xs text-blue-400 text-center">
              This report measures how energy moves through your body — not joint angles or bat sensors.
            </p>
          </div>
          
          {/* File Status */}
          <div className="flex gap-2">
            <Badge variant={session.ik_file_uploaded ? "default" : "secondary"}>
              IK {session.ik_file_uploaded ? "✓" : "✗"}
            </Badge>
            <Badge variant={session.me_file_uploaded ? "default" : "secondary"}>
              ME {session.me_file_uploaded ? "✓" : "✗"}
            </Badge>
          </div>
          
          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex-1"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete Session
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
