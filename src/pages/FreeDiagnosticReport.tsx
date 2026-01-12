import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Brain, 
  Activity, 
  Zap, 
  Target, 
  Lock, 
  ArrowRight, 
  Dumbbell,
  TrendingUp
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { cn } from "@/lib/utils";

// Placeholder data - will be wired to real values later
const placeholderData = {
  playerName: "Alex Johnson",
  level: "High School Varsity",
  bats: "Right",
  throws: "Right",
  date: "January 12, 2026",
  barrelScore: 42,
  bodyScore: 36,
  mainLeak: "Torso Bypass",
  leakExplanation: "Your legs create energy, but your core isn't catching enough before your arms swing.",
  potentialEV: 87,
  drill: {
    name: "Core Catch & Turn",
    description: "Fixes torso bypass and helps your core catch leg energy.",
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
    borderColor: 'border-blue-500/30'
  },
  body: { 
    label: 'BODY', 
    subtitle: 'Movement & Sequencing',
    icon: Activity, 
    color: 'text-green-500', 
    bgLight: 'bg-green-500/10',
    borderColor: 'border-green-500/30'
  },
  bat: { 
    label: 'BAT', 
    subtitle: 'Barrel Control',
    icon: Zap, 
    color: 'text-orange-500', 
    bgLight: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30'
  },
  ball: { 
    label: 'BALL', 
    subtitle: 'Contact Quality',
    icon: Target, 
    color: 'text-red-500', 
    bgLight: 'bg-red-500/10',
    borderColor: 'border-red-500/30'
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
    <div className="relative w-36 h-36 md:w-44 md:h-44">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        {/* Background circle */}
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-slate-700"
        />
        {/* Progress circle */}
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
        <span className="text-4xl md:text-5xl font-black text-white">{score}</span>
        <span className="text-xs text-slate-400 font-medium">/ 100</span>
      </div>
    </div>
  );
}

// Locked Card Component
function LockedCard({ category }: { category: 'brain' | 'bat' | 'ball' }) {
  const config = categoryConfig[category];
  const Icon = config.icon;

  const scrollToCTA = () => {
    document.getElementById('upgrade-cta')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <button
      onClick={scrollToCTA}
      className={cn(
        "relative overflow-hidden rounded-xl p-4 text-center transition-all",
        "bg-slate-900/50 border border-slate-700/50",
        "hover:border-slate-600 hover:bg-slate-800/50 cursor-pointer",
        "group"
      )}
    >
      {/* Blur overlay */}
      <div className="absolute inset-0 backdrop-blur-[2px] bg-slate-950/60 z-10 flex flex-col items-center justify-center gap-2">
        <Lock className="w-5 h-5 text-slate-500" />
        <span className="text-xs text-slate-500 font-medium">Locked</span>
      </div>
      
      {/* Blurred content behind */}
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
        <div className="text-xs text-slate-600 mt-1">
          {config.subtitle}
        </div>
      </div>
    </button>
  );
}

// Unlocked Body Card (smaller version for the row)
function UnlockedBodyCardSmall({ score }: { score: number }) {
  const config = categoryConfig.body;
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
      <div className="text-xs text-slate-400 mt-1">
        {config.subtitle}
      </div>
      <Badge className="mt-2 bg-green-500/20 text-green-400 border-green-500/30 text-xs">
        ✓ Unlocked
      </Badge>
    </div>
  );
}

export default function FreeDiagnosticReport() {
  const { sessionId } = useParams();
  const data = placeholderData; // Will be replaced with real data fetch

  return (
    <div className="min-h-screen bg-slate-950">
      <Header />

      <main className="pt-24 pb-32 px-4">
        <div className="max-w-4xl mx-auto space-y-8">
          
          {/* Hero Card */}
          <Card className="bg-slate-900 border-slate-800 overflow-hidden">
            <CardContent className="p-0">
              <div className="flex flex-col md:flex-row">
                {/* Left: Player Info */}
                <div className="flex-1 p-6 md:p-8">
                  <Badge className="bg-red-500/20 text-red-400 border-red-500/30 mb-4">
                    Free Swing Diagnostic
                  </Badge>
                  <h1 className="text-2xl md:text-3xl font-black text-white mb-4">
                    {data.playerName}
                  </h1>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-slate-500">Level</span>
                      <p className="text-white font-medium">{data.level}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Bats / Throws</span>
                      <p className="text-white font-medium">{data.bats} / {data.throws}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-500">Diagnostic Date</span>
                      <p className="text-white font-medium">{data.date}</p>
                    </div>
                  </div>
                </div>

                {/* Right: Barrel Score Gauge */}
                <div className="flex flex-col items-center justify-center p-6 md:p-8 bg-slate-800/50 md:min-w-[220px]">
                  <BarrelScoreGauge score={data.barrelScore} />
                  <div className="text-center mt-3">
                    <p className="text-white font-bold text-sm">Barrel Score</p>
                    <p className="text-slate-500 text-xs">(Snapshot)</p>
                  </div>
                  <p className="text-slate-400 text-xs text-center mt-2 max-w-[180px]">
                    Baseline diagnostic only – not full KRS score.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Unlocked Body Insight */}
          <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-2 border-green-500/40">
            <CardContent className="p-6 md:p-8">
              <div className="flex items-center gap-2 mb-4">
                <div className="bg-green-500/20 rounded-full p-2">
                  <Activity className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">BODY – Your Engine</h2>
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                    ✓ UNLOCKED INSIGHT
                  </Badge>
                </div>
              </div>

              <div className="flex items-baseline gap-3 mb-4">
                <span className="text-5xl md:text-6xl font-black text-green-500">{data.bodyScore}</span>
                <span className="text-slate-400 text-lg">Movement & Sequencing</span>
              </div>

              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 mb-3">
                Main Leak: {data.mainLeak}
              </Badge>

              <p className="text-slate-300 text-base leading-relaxed">
                "{data.leakExplanation}"
              </p>
            </CardContent>
          </Card>

          {/* Locked 4B Row */}
          <div>
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">
              Full 4B Breakdown
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <LockedCard category="brain" />
              <UnlockedBodyCardSmall score={data.bodyScore} />
              <LockedCard category="bat" />
              <LockedCard category="ball" />
            </div>
            <p className="text-center text-slate-500 text-sm mt-3">
              Tap locked cards to unlock full report
            </p>
          </div>

          {/* Potential vs Actual Teaser */}
          <Card className="bg-slate-900/80 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-red-500/20 rounded-full p-2">
                  <TrendingUp className="h-5 w-5 text-red-400" />
                </div>
                <h3 className="text-lg font-bold text-white">Kinetic Exit Velocity Potential</h3>
              </div>
              
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-4xl font-black text-red-400">{data.potentialEV}</span>
                <span className="text-slate-400 text-lg">mph</span>
              </div>
              
              <p className="text-slate-400 text-sm">
                Actual game EV is likely lower right now because of current leaks.
              </p>
              <p className="text-slate-500 text-xs mt-2 italic">
                Full Ball breakdown available in KRS report.
              </p>
            </CardContent>
          </Card>

          {/* Drill Teaser */}
          <Card className="bg-slate-900/80 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-blue-500/20 rounded-full p-2">
                  <Dumbbell className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Recommended Drill</h3>
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                    1 of 8 Unlocked
                  </Badge>
                </div>
              </div>

              <div className="bg-slate-800/50 rounded-lg p-4 mb-4">
                <h4 className="font-bold text-white mb-1">{data.drill.name}</h4>
                <p className="text-slate-300 text-sm">{data.drill.description}</p>
              </div>

              <p className="text-slate-500 text-sm flex items-center gap-2">
                <Lock className="w-4 h-4" />
                + 7 more personalized drills locked until you unlock the full report.
              </p>
            </CardContent>
          </Card>

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
                Skip straight to Coaching – $99/month includes your full KRS report and ongoing KRS sessions
              </Link>
            </div>
          </div>

        </div>
      </main>

      {/* Mobile Sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-950/95 backdrop-blur border-t border-slate-800 md:hidden z-50">
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
