import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Brain, Activity, Zap, Target } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScoreInputProps {
  scores: {
    brain: number;
    body: number;
    bat: number;
    ball: number;
  };
  onChange: (scores: { brain: number; body: number; bat: number; ball: number }) => void;
  disabled?: boolean;
}

const scoreConfig = [
  { key: 'brain', label: 'Brain', subtitle: 'Timing / Sequencing', icon: Brain, color: 'text-blue-500', bg: 'bg-blue-500' },
  { key: 'body', label: 'Body', subtitle: 'Legs / Hips', icon: Activity, color: 'text-green-500', bg: 'bg-green-500' },
  { key: 'bat', label: 'Bat', subtitle: 'Mechanics', icon: Zap, color: 'text-red-500', bg: 'bg-red-500' },
  { key: 'ball', label: 'Ball', subtitle: 'Impact', icon: Target, color: 'text-orange-500', bg: 'bg-orange-500' }
] as const;

function getScoreColor(score: number): string {
  if (score <= 4) return 'text-red-500';
  if (score <= 6) return 'text-yellow-500';
  return 'text-green-500';
}

function getScoreBarColor(score: number): string {
  if (score <= 4) return 'bg-red-500';
  if (score <= 6) return 'bg-yellow-500';
  return 'bg-green-500';
}

export function ScoreInput({ scores, onChange, disabled }: ScoreInputProps) {
  const overallScore = ((scores.brain + scores.body + scores.bat + scores.ball) / 4).toFixed(1);
  
  const weakest = Object.entries(scores).reduce((min, [key, val]) => 
    val < min.val ? { key, val } : min, { key: 'brain', val: 10 }
  );

  return (
    <div className="space-y-6">
      {scoreConfig.map(({ key, label, subtitle, icon: Icon, color }) => {
        const score = scores[key as keyof typeof scores];
        return (
          <div key={key} className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Icon className={cn("h-4 w-4", color)} />
                <span className="font-medium">{label}</span>
                <span className="text-xs text-muted-foreground">({subtitle})</span>
              </Label>
              <span className={cn("text-xl font-bold tabular-nums", getScoreColor(score))}>
                {score}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Slider
                value={[score]}
                onValueChange={([val]) => onChange({ ...scores, [key]: val })}
                min={1}
                max={10}
                step={1}
                disabled={disabled}
                className="flex-1"
              />
              <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className={cn("h-full transition-all", getScoreBarColor(score))}
                  style={{ width: `${score * 10}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
      
      <div className="pt-4 border-t space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-medium">Overall Score</span>
          <span className={cn("text-2xl font-bold", getScoreColor(parseFloat(overallScore)))}>
            {overallScore} <span className="text-sm text-muted-foreground">/ 10</span>
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Weakest Category</span>
          <span className="font-medium text-amber-500 uppercase flex items-center gap-1">
            ⚠️ {weakest.key}
          </span>
        </div>
      </div>
    </div>
  );
}
