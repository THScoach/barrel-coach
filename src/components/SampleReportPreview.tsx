import { Brain, Activity, Zap, Target, Lock, Dumbbell, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const sampleScores = {
  brain: 68,
  body: 65,
  bat: 52,
  ball: 61,
  composite: 62,
  grade: 'Above Avg',
  weakest: 'bat',
};

const categoryConfig = {
  brain: { 
    label: 'BRAIN', 
    subtitle: 'Timing & Recognition',
    icon: Brain, 
    color: 'text-blue-500', 
    bgLight: 'bg-blue-500/10'
  },
  body: { 
    label: 'BODY', 
    subtitle: 'Sequencing & Power',
    icon: Activity, 
    color: 'text-green-500', 
    bgLight: 'bg-green-500/10'
  },
  bat: { 
    label: 'BAT', 
    subtitle: 'Barrel Control',
    icon: Zap, 
    color: 'text-accent', 
    bgLight: 'bg-accent/10'
  },
  ball: { 
    label: 'BALL', 
    subtitle: 'Contact Quality',
    icon: Target, 
    color: 'text-orange-500', 
    bgLight: 'bg-orange-500/10'
  }
};

const getScoreColor = (score: number) => {
  if (score >= 70) return 'text-green-500';
  if (score >= 50) return 'text-yellow-500';
  return 'text-accent';
};

export function SampleReportPreview() {
  return (
    <section className="py-16 bg-background">
      <div className="container">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">
            SEE A SAMPLE REPORT
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Here's what you'll get: A complete 4B Score Card identifying your weakest link and the exact drill to fix it.
          </p>
        </div>

        <div className="max-w-lg mx-auto relative">
          {/* Watermark overlay */}
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <div className="text-6xl md:text-7xl font-black text-primary/5 rotate-[-15deg] select-none whitespace-nowrap">
              SAMPLE
            </div>
          </div>

          {/* Score Card */}
          <div className="bg-card rounded-2xl shadow-card overflow-hidden border border-border relative">
            {/* Header */}
            <div className="bg-primary text-primary-foreground p-5 text-center">
              <h3 className="text-xl font-bold mb-0.5">YOUR 4B SCORE CARD</h3>
              <p className="text-primary-foreground/70 text-xs">The 4B Hitting System™</p>
            </div>

            {/* Scores Grid */}
            <div className="grid grid-cols-2 gap-px bg-border">
              {(['brain', 'body', 'bat', 'ball'] as const).map(category => {
                const config = categoryConfig[category];
                const score = sampleScores[category];
                const isWeakest = sampleScores.weakest === category;

                return (
                  <div 
                    key={category} 
                    className={`p-4 text-center ${isWeakest ? 'bg-amber-500/5 ring-2 ring-inset ring-amber-500' : 'bg-card'}`}
                  >
                    <div className={`inline-flex items-center justify-center w-10 h-10 rounded-full mb-2 ${config.bgLight}`}>
                      <config.icon className={`h-5 w-5 ${config.color}`} />
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
                      {config.label}
                    </div>
                    <div className={`text-3xl font-bold ${getScoreColor(score)}`}>
                      {score}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {config.subtitle}
                    </div>
                    {isWeakest && (
                      <Badge className="mt-1.5 text-[10px] bg-amber-500/20 text-amber-600 border-amber-500/30">
                        ⚠️ Weakest Link
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Overall Score */}
            <div className="p-4 bg-surface border-t border-border">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">Overall Score</div>
                  <Badge variant="outline" className="mt-1 text-xs">
                    {sampleScores.grade}
                  </Badge>
                </div>
                <div className="text-right">
                  <span className={`text-4xl font-bold ${getScoreColor(sampleScores.composite)}`}>
                    {sampleScores.composite}
                  </span>
                  <span className="text-muted-foreground text-sm">/100</span>
                </div>
              </div>
            </div>

            {/* Weakest Link Callout */}
            <div className="p-4 bg-amber-500/10 border-t border-amber-500/20">
              <div className="flex items-start gap-3">
                <div className="bg-amber-500/20 rounded-full p-1.5 flex-shrink-0">
                  <Target className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <div className="font-bold text-amber-700 dark:text-amber-500 text-sm">
                    Priority Fix: BAT
                  </div>
                  <div className="text-xs text-amber-600/80 dark:text-amber-400/80">
                    Late Barrel Release — losing 30-50 feet of distance
                  </div>
                </div>
              </div>
            </div>

            {/* Drill Prescription Section */}
            <div className="p-4 bg-surface border-t border-border">
              <div className="flex items-center gap-2 mb-3">
                <Dumbbell className="h-4 w-4 text-accent" />
                <span className="font-bold text-sm">YOUR DRILL PRESCRIPTION</span>
              </div>
              
              <div className="bg-card rounded-lg border border-border p-3">
                <div className="flex items-start gap-3">
                  <div className="w-16 h-12 bg-primary/10 rounded flex items-center justify-center flex-shrink-0">
                    <Play className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">Connection Ball Drill</div>
                    <div className="text-xs text-muted-foreground mt-0.5">3 sets × 10 reps</div>
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      Put a tennis ball under your front armpit. Swing without dropping it.
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3 text-center">
                <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
                  <Lock className="h-3 w-3" />
                  Full video demo included with purchase
                </div>
              </div>
            </div>
          </div>

          {/* CTA Below */}
          <div className="mt-8 text-center">
            <Button asChild variant="hero" size="lg">
              <Link to="/analyze">GET YOUR OWN REPORT — $37</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}