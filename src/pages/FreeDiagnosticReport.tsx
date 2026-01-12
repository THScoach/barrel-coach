import { useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  Brain, 
  Activity, 
  Zap, 
  Target, 
  Lock, 
  ArrowRight, 
  Dumbbell,
  TrendingUp,
  Play
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// TypeScript type for Free Diagnostic data
export type FreeDiagnosticData = {
  player: {
    name: string;
    level: string;
    bats: string;
    throws: string;
  };
  sessionDate: string; // ISO
  snapshotBarrelScore: number; // 0–100
  unlockedB: 'brain' | 'body' | 'bat' | 'ball'; // for now always 'body'
  unlockedScore: number; // 20–80 score for that B
  unlockedLabel: string; // e.g. "Movement & Sequencing"
  mainLeak: string; // e.g. "Torso Bypass"
  coachingSentence: string;
  potentialExitVelo: number | null;
  teaserDrill: {
    title: string;
    description: string;
    thumbnailUrl?: string;
  } | null;
};

// Mock data - replace with real data later
const mockData: FreeDiagnosticData = {
  player: {
    name: "Beckett Walters",
    level: "Youth 14U",
    bats: "L",
    throws: "L",
  },
  sessionDate: new Date().toISOString(),
  snapshotBarrelScore: 42,
  unlockedB: 'body',
  unlockedScore: 36,
  unlockedLabel: "Movement & Sequencing",
  mainLeak: "Torso Bypass",
  coachingSentence: "Your legs create energy, but your core isn't catching enough before your arms swing. This is costing you bat speed and consistency.",
  potentialExitVelo: 93,
  teaserDrill: {
    title: "Core Catch & Turn",
    description: "Fixes torso bypass by teaching your core to catch and transfer leg energy before your arms fire.",
    thumbnailUrl: undefined,
  },
};

// 4B Category config
const categoryConfig = {
  brain: { 
    label: 'BRAIN', 
    subtitle: 'Timing & Recognition',
    icon: Brain, 
    color: 'text-blue-500', 
    bgLight: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    gradient: 'from-blue-500/20 to-blue-500/5'
  },
  body: { 
    label: 'BODY', 
    subtitle: 'Movement & Sequencing',
    icon: Activity, 
    color: 'text-green-500', 
    bgLight: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    gradient: 'from-green-500/20 to-green-500/5'
  },
  bat: { 
    label: 'BAT', 
    subtitle: 'Barrel Delivery',
    icon: Zap, 
    color: 'text-orange-500', 
    bgLight: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
    gradient: 'from-orange-500/20 to-orange-500/5'
  },
  ball: { 
    label: 'BALL', 
    subtitle: 'Contact Quality',
    icon: Target, 
    color: 'text-red-500', 
    bgLight: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    gradient: 'from-red-500/20 to-red-500/5'
  }
};

// Barrel Score Gauge Component
function BarrelScoreGauge({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 45;
  const progress = (score / 100) * circumference;
  
  const getScoreColor = (s: number) => {
    if (s >= 70) return 'stroke-green-500';
    if (s >= 50) return 'stroke-yellow-500';
    return 'stroke-red-500';
  };

  return (
    <div className="relative w-32 h-32 md:w-40 md:h-40">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-slate-700"
        />
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          className={cn("transition-all duration-1000", getScoreColor(score))}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl md:text-4xl font-black text-white">{score}</span>
      </div>
    </div>
  );
}

// Locked Card with Popover
function LockedCardWithPopover({ 
  category, 
  onScrollToCTA 
}: { 
  category: 'brain' | 'bat' | 'ball';
  onScrollToCTA: () => void;
}) {
  const config = categoryConfig[category];
  const Icon = config.icon;
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "relative overflow-hidden rounded-xl p-4 text-center transition-all w-full",
            "bg-slate-900/50 border border-slate-700/50",
            "hover:border-slate-600 hover:bg-slate-800/50 cursor-pointer",
            "focus:outline-none focus:ring-2 focus:ring-slate-600"
          )}
        >
          {/* Blur overlay */}
          <div className="absolute inset-0 backdrop-blur-[2px] bg-slate-950/60 z-10 flex flex-col items-center justify-center gap-1">
            <Lock className="w-5 h-5 text-slate-500" />
            <span className="text-xs text-slate-500 font-medium">Locked</span>
          </div>
          
          {/* Blurred content */}
          <div className="opacity-30">
            <div className={cn(
              "inline-flex items-center justify-center w-10 h-10 rounded-full mb-2",
              config.bgLight
            )}>
              <Icon className={cn("h-5 w-5", config.color)} />
            </div>
            <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">
              {config.label}
            </div>
            <div className="text-2xl font-bold text-slate-600">??</div>
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 bg-slate-900 border-slate-700 p-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-slate-400" />
            <span className="font-bold text-white text-sm">Full {config.label} Analysis Locked</span>
          </div>
          <p className="text-slate-400 text-sm">
            Unlock the full KRS 4B breakdown, Ball metrics, and all personalized drills for $37.
          </p>
          <Button
            size="sm"
            className="w-full bg-red-600 hover:bg-red-700 text-white"
            onClick={() => {
              setOpen(false);
              onScrollToCTA();
            }}
          >
            Unlock Full Report – $37
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Unlocked B Card (small version for the row)
function UnlockedBCardSmall({ 
  category, 
  score, 
  label 
}: { 
  category: 'brain' | 'body' | 'bat' | 'ball';
  score: number;
  label: string;
}) {
  const config = categoryConfig[category];
  const Icon = config.icon;

  return (
    <div className={cn(
      "rounded-xl p-4 text-center",
      "bg-green-500/10 border-2 border-green-500/40"
    )}>
      <div className={cn(
        "inline-flex items-center justify-center w-10 h-10 rounded-full mb-2",
        config.bgLight
      )}>
        <Icon className={cn("h-5 w-5", config.color)} />
      </div>
      <div className="text-xs uppercase tracking-wider text-green-400 mb-1">
        {config.label}
      </div>
      <div className="text-2xl font-bold text-green-500">{score}</div>
      <Badge className="mt-2 bg-green-500/20 text-green-400 border-green-500/30 text-xs">
        ✓ Unlocked
      </Badge>
    </div>
  );
}

export default function FreeDiagnosticReport() {
  const { sessionId } = useParams();
  const data = mockData; // Will be replaced with real data fetch

  const scrollToCTA = () => {
    document.getElementById('upgrade-cta')?.scrollIntoView({ behavior: 'smooth' });
  };

  const formattedDate = format(new Date(data.sessionDate), 'MMMM d, yyyy');
  const unlockedConfig = categoryConfig[data.unlockedB];
  const UnlockedIcon = unlockedConfig.icon;

  // Determine which cards are locked (all except the unlocked B)
  const fourBCategories: Array<'brain' | 'body' | 'bat' | 'ball'> = ['brain', 'body', 'bat', 'ball'];

  return (
    <div className="min-h-screen bg-slate-950">
      <Header />

      <main className="pt-24 pb-32 px-4">
        <div className="max-w-4xl mx-auto space-y-6">
          
          {/* Hero Card */}
          <Card className="bg-slate-900 border-slate-800 overflow-hidden">
            <CardContent className="p-0">
              <div className="flex flex-col md:flex-row">
                {/* Left: Player Info */}
                <div className="flex-1 p-6 md:p-8">
                  <Badge className="bg-red-500/20 text-red-400 border-red-500/30 mb-4">
                    Free Swing Diagnostic
                  </Badge>
                  <h1 className="text-2xl md:text-3xl font-black text-white mb-2">
                    {data.player.name} – {data.player.level}
                  </h1>
                  <p className="text-slate-400 text-sm mb-4">
                    Bats {data.player.bats} / Throws {data.player.throws}
                  </p>
                  <div className="text-sm">
                    <span className="text-slate-500">Diagnostic Date</span>
                    <p className="text-white font-medium">{formattedDate}</p>
                  </div>
                </div>

                {/* Right: Barrel Score Gauge */}
                <div className="flex flex-col items-center justify-center p-6 md:p-8 bg-slate-800/50 md:min-w-[200px]">
                  <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">
                    Barrel Score (Snapshot)
                  </p>
                  <BarrelScoreGauge score={data.snapshotBarrelScore} />
                  <p className="text-slate-500 text-xs text-center mt-3 max-w-[180px]">
                    Baseline diagnostic only – full KRS report locked.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Unlocked Insight Section */}
          <Card className={cn(
            "border-2",
            `bg-gradient-to-br ${unlockedConfig.gradient}`,
            unlockedConfig.borderColor.replace('border-', 'border-').replace('/30', '/40')
          )}>
            <CardContent className="p-6 md:p-8">
              <div className="flex items-center gap-3 mb-5">
                <div className={cn("rounded-full p-2.5", unlockedConfig.bgLight)}>
                  <UnlockedIcon className={cn("h-6 w-6", unlockedConfig.color)} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {unlockedConfig.label} – Your Engine
                  </h2>
                  <Badge className={cn(
                    "text-xs mt-1",
                    unlockedConfig.bgLight,
                    unlockedConfig.color,
                    unlockedConfig.borderColor
                  )}>
                    ✓ UNLOCKED INSIGHT
                  </Badge>
                </div>
              </div>

              <div className="flex items-baseline gap-3 mb-4">
                <span className={cn("text-5xl md:text-6xl font-black", unlockedConfig.color)}>
                  {data.unlockedScore}
                </span>
                <span className="text-slate-300 text-lg">{data.unlockedLabel}</span>
              </div>

              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 mb-4">
                Main Leak: {data.mainLeak}
              </Badge>

              <p className="text-slate-300 text-base leading-relaxed">
                "{data.coachingSentence}"
              </p>
            </CardContent>
          </Card>

          {/* Locked 4B Strip */}
          <div>
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">
              Full 4B Breakdown
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {fourBCategories.map(category => {
                if (category === data.unlockedB) {
                  return (
                    <UnlockedBCardSmall 
                      key={category}
                      category={category}
                      score={data.unlockedScore}
                      label={data.unlockedLabel}
                    />
                  );
                }
                return (
                  <LockedCardWithPopover 
                    key={category}
                    category={category as 'brain' | 'bat' | 'ball'}
                    onScrollToCTA={scrollToCTA}
                  />
                );
              })}
            </div>
            <p className="text-center text-slate-500 text-sm mt-3">
              Tap locked cards to see what you're missing
            </p>
          </div>

          {/* Potential Exit Velo Teaser */}
          {data.potentialExitVelo !== null && (
            <Card className="bg-slate-900/80 border-slate-700">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-red-500/20 rounded-full p-2.5">
                    <TrendingUp className="h-5 w-5 text-red-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white">Your Potential Exit Velo</h3>
                </div>
                
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-5xl font-black text-red-400">{data.potentialExitVelo}</span>
                  <span className="text-slate-400 text-xl">mph</span>
                </div>
                
                <p className="text-slate-300 text-sm">
                  Based on your kinetic engine, you're capable of much more when leaks are closed.
                </p>
                <p className="text-slate-500 text-xs mt-2 italic flex items-center gap-1.5">
                  <Lock className="w-3 h-3" />
                  Full Ball metrics available in KRS report.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Drill Teaser */}
          {data.teaserDrill && (
            <Card className="bg-slate-900/80 border-slate-700">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-blue-500/20 rounded-full p-2.5">
                    <Dumbbell className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Your First Drill</h3>
                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                      1 of 8 Unlocked
                    </Badge>
                  </div>
                </div>

                <div className="flex gap-4">
                  {/* Thumbnail */}
                  {data.teaserDrill.thumbnailUrl ? (
                    <div className="relative w-24 h-24 md:w-32 md:h-32 rounded-lg overflow-hidden bg-slate-800 flex-shrink-0">
                      <img 
                        src={data.teaserDrill.thumbnailUrl} 
                        alt={data.teaserDrill.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Play className="w-8 h-8 text-white" />
                      </div>
                    </div>
                  ) : (
                    <div className="w-24 h-24 md:w-32 md:h-32 rounded-lg bg-slate-800 flex-shrink-0 flex items-center justify-center">
                      <Play className="w-8 h-8 text-slate-600" />
                    </div>
                  )}
                  
                  {/* Drill info */}
                  <div className="flex-1">
                    <h4 className="font-bold text-white mb-2">{data.teaserDrill.title}</h4>
                    <p className="text-slate-300 text-sm">{data.teaserDrill.description}</p>
                  </div>
                </div>

                <p className="text-slate-500 text-sm flex items-center gap-2 mt-4 pt-4 border-t border-slate-800">
                  <Lock className="w-4 h-4" />
                  Full KRS report unlocks all personalized drills for your leaks.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Upgrade CTA */}
          <div 
            id="upgrade-cta"
            className="bg-gradient-to-br from-red-500/20 via-slate-900 to-blue-500/20 rounded-2xl border border-red-500/30 p-8 text-center"
          >
            <h2 className="text-2xl md:text-3xl font-black text-white mb-3">
              Ready to See the Full Picture?
            </h2>
            <p className="text-slate-300 mb-6 max-w-xl mx-auto">
              Unlock your complete 4B breakdown, all 8 personalized drills, and AI-powered coaching insights.
            </p>

            <div className="flex flex-col gap-4 max-w-md mx-auto">
              <Button
                asChild
                size="lg"
                className="bg-red-600 hover:bg-red-700 text-white font-bold h-14 text-lg"
              >
                <Link to="/diagnostic?upgrade=assessment">
                  Unlock Full KRS Report – $37
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Link>
              </Button>

              <Link 
                to="/coaching" 
                className="text-slate-400 hover:text-white transition-colors text-sm underline underline-offset-4"
              >
                Skip straight to Coaching – $99/month includes your full KRS report and ongoing sessions
              </Link>
            </div>
          </div>

        </div>
      </main>

      {/* Mobile Sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-950/95 backdrop-blur-sm border-t border-slate-800 md:hidden z-50">
        <Button
          asChild
          size="lg"
          className="w-full bg-red-600 hover:bg-red-700 text-white font-bold h-12"
        >
          <Link to="/diagnostic?upgrade=assessment">
            Unlock Full Report – $37
            <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </Button>
      </div>

      <Footer />
    </div>
  );
}
