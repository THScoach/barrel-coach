/**
 * WeaponDrillPrescription - Recommends drills based on weak weapon metrics
 * Analyzes WIP, Plane, Square-Up, and Impact scores to prescribe targeted fixes
 */

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { WeaponMetrics } from '@/lib/weapon-metrics';
import { 
  Zap, 
  Target, 
  ArrowRightLeft, 
  Gauge,
  PlayCircle,
  AlertTriangle,
  Wrench,
  ChevronRight,
  Dumbbell
} from 'lucide-react';
import { Link } from 'react-router-dom';

// Drill recommendations mapped to each weapon metric
const DRILL_PRESCRIPTIONS = {
  wipIndex: {
    name: 'WIP Index',
    icon: Zap,
    color: 'orange',
    issue: 'Power leaking before impact',
    drills: [
      {
        name: 'Wrist Snap Drill',
        slug: 'wrist-snap',
        description: 'Focus on late hand release to maximize bat whip',
        cue: 'Let the barrel lag, then snap through',
        duration: '10 reps',
      },
      {
        name: 'Connection Drill',
        slug: 'connection',
        description: 'Keep hands connected to body rotation',
        cue: 'Elbows stay tucked until rotation pulls them',
        duration: '15 reps',
      },
      {
        name: 'Towel Whip Drill',
        slug: 'towel-whip',
        description: 'Train proper sequencing with a towel',
        cue: 'Whip should crack at the end, not the start',
        duration: '20 reps',
      },
    ],
  },
  planeIntegrity: {
    name: 'Plane Integrity',
    icon: ArrowRightLeft,
    color: 'blue',
    issue: 'Swing path wandering',
    drills: [
      {
        name: 'Rail Swings',
        slug: 'rail-swings',
        description: 'Use a physical guide to groove consistent path',
        cue: 'Stay on the rail, barrel matches the plane',
        duration: '15 reps',
      },
      {
        name: 'Tee Work - High/Low',
        slug: 'tee-high-low',
        description: 'Train matching swing plane to pitch height',
        cue: 'Adjust your plane, not just your hands',
        duration: '10 each zone',
      },
      {
        name: 'One-Arm Swings',
        slug: 'one-arm',
        description: 'Isolate each arm to find path issues',
        cue: 'Top hand guides, bottom hand powers',
        duration: '10 each arm',
      },
    ],
  },
  squareUpConsistency: {
    name: 'Square-Up',
    icon: Target,
    color: 'emerald',
    issue: 'Contact point inconsistent',
    drills: [
      {
        name: 'Barrel Control Drill',
        slug: 'barrel-control',
        description: 'Focus on finding the sweet spot repeatedly',
        cue: 'Eyes to contact, feel the barrel',
        duration: '20 reps',
      },
      {
        name: 'Inside/Outside Tee',
        slug: 'inside-outside-tee',
        description: 'Train adjusting contact point by pitch location',
        cue: 'Let the ball travel, stay inside',
        duration: '10 each side',
      },
      {
        name: 'Soft Toss Tracking',
        slug: 'soft-toss-tracking',
        description: 'Track the ball deep, square it up late',
        cue: 'See it long, hit it hard',
        duration: '25 reps',
      },
    ],
  },
  impactMomentum: {
    name: 'Impact Momentum',
    icon: Gauge,
    color: 'violet',
    issue: 'Power not delivered at contact',
    drills: [
      {
        name: 'Heavy Bat Swings',
        slug: 'heavy-bat',
        description: 'Build strength through the zone',
        cue: 'Drive through, don\'t stop at contact',
        duration: '15 reps',
      },
      {
        name: 'Medicine Ball Rotations',
        slug: 'med-ball-rotation',
        description: 'Train explosive hip-to-hand transfer',
        cue: 'Fire from the ground, release at the wall',
        duration: '12 reps',
      },
      {
        name: 'Overload/Underload',
        slug: 'overload-underload',
        description: 'Alternate heavy and light bats for power',
        cue: 'Heavy for strength, light for speed',
        duration: '10 each',
      },
    ],
  },
};

// Threshold below which we prescribe drills
const WEAKNESS_THRESHOLD = 50;
const CRITICAL_THRESHOLD = 40;

interface WeaponDrillPrescriptionProps {
  metrics: WeaponMetrics;
  className?: string;
  showAll?: boolean; // Show all drills, not just for weak metrics
  onDrillClick?: (drillSlug: string) => void;
}

interface WeakMetric {
  key: keyof typeof DRILL_PRESCRIPTIONS;
  score: number;
  isCritical: boolean;
}

export function WeaponDrillPrescription({ 
  metrics, 
  className,
  showAll = false,
  onDrillClick 
}: WeaponDrillPrescriptionProps) {
  
  // Find weak metrics
  const weakMetrics: WeakMetric[] = [];
  
  const checkMetric = (key: keyof typeof DRILL_PRESCRIPTIONS, value: number | null) => {
    if (value === null) return;
    if (showAll || value < WEAKNESS_THRESHOLD) {
      weakMetrics.push({
        key,
        score: value,
        isCritical: value < CRITICAL_THRESHOLD,
      });
    }
  };
  
  checkMetric('wipIndex', metrics.wipIndex);
  checkMetric('planeIntegrity', metrics.planeIntegrity);
  checkMetric('squareUpConsistency', metrics.squareUpConsistency);
  checkMetric('impactMomentum', metrics.impactMomentum);
  
  // Sort by score (lowest first = most urgent)
  weakMetrics.sort((a, b) => a.score - b.score);
  
  // No weak metrics found
  if (weakMetrics.length === 0 && !showAll) {
    return (
      <Card className={cn("p-6 bg-gradient-to-br from-emerald-950/50 to-slate-900 border-emerald-800/50", className)}>
        <div className="flex items-center gap-3 text-emerald-400">
          <div className="p-2 rounded-full bg-emerald-500/20">
            <Target className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold">All Weapons Firing</h3>
            <p className="text-sm text-emerald-300/70">
              No drill prescriptions needed - all metrics above threshold
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn("p-4 sm:p-6 bg-gradient-to-br from-slate-900 to-slate-950 border-slate-800", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/20">
            <Wrench className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h3 className="font-bold text-white">Drill Prescription</h3>
            <p className="text-xs text-muted-foreground">
              {weakMetrics.length} {weakMetrics.length === 1 ? 'area' : 'areas'} to address
            </p>
          </div>
        </div>
        
        {weakMetrics.some(m => m.isCritical) && (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Critical Leak
          </Badge>
        )}
      </div>

      {/* Weak Metrics with Drills */}
      <div className="space-y-5">
        {weakMetrics.map(({ key, score, isCritical }) => {
          const config = DRILL_PRESCRIPTIONS[key];
          const Icon = config.icon;
          
          return (
            <div 
              key={key}
              className={cn(
                "rounded-lg border p-4",
                isCritical 
                  ? "bg-red-950/30 border-red-800/50" 
                  : "bg-slate-800/50 border-slate-700/50"
              )}
            >
              {/* Metric Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Icon className={cn(
                    "h-4 w-4",
                    config.color === 'orange' && "text-orange-400",
                    config.color === 'blue' && "text-blue-400",
                    config.color === 'emerald' && "text-emerald-400",
                    config.color === 'violet' && "text-violet-400"
                  )} />
                  <span className="font-semibold text-white text-sm">{config.name}</span>
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-xs",
                      isCritical ? "border-red-500/50 text-red-400" : "border-amber-500/50 text-amber-400"
                    )}
                  >
                    {score}
                  </Badge>
                </div>
                
                <span className="text-xs text-muted-foreground italic">
                  {config.issue}
                </span>
              </div>

              {/* Drills List */}
              <div className="space-y-2">
                {config.drills.slice(0, 2).map((drill) => (
                  <div 
                    key={drill.slug}
                    className="flex items-center justify-between p-3 rounded-md bg-slate-900/60 hover:bg-slate-800/60 transition-colors group cursor-pointer"
                    onClick={() => onDrillClick?.(drill.slug)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded bg-primary/20 text-primary">
                        <Dumbbell className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <p className="font-medium text-sm text-white">{drill.name}</p>
                        <p className="text-xs text-muted-foreground">{drill.cue}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs border-slate-600">
                        {drill.duration}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
              
              {/* View All Link */}
              {config.drills.length > 2 && (
                <Link 
                  to={`/drills?focus=${key}`}
                  className="flex items-center justify-center gap-1 mt-3 text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  <PlayCircle className="h-3.5 w-3.5" />
                  View all {config.drills.length} drills for {config.name}
                </Link>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer CTA */}
      <div className="mt-5 pt-4 border-t border-slate-800">
        <Link to="/drills">
          <Button variant="outline" className="w-full border-slate-700 hover:bg-slate-800">
            <Dumbbell className="h-4 w-4 mr-2" />
            View Full Drill Library
          </Button>
        </Link>
      </div>
    </Card>
  );
}
