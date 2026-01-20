import { useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { 
  ArrowRight, 
  Target, 
  Check,
  X,
  MessageCircle,
  Loader2,
  Brain,
  Zap,
  Activity,
  TrendingUp
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// 4B Bio-Engine cards
const fourBCards = [
  {
    key: "brain",
    name: "BRAIN",
    tagline: "Pattern Consistency",
    description: "How repeatable is your movement pattern swing after swing?",
    icon: Brain,
    score: 62,
  },
  {
    key: "body",
    name: "BODY",
    tagline: "Energy Production",
    description: "How much power does your lower body and core generate?",
    icon: Zap,
    score: 58,
  },
  {
    key: "bat",
    name: "BAT",
    tagline: "Energy Delivery",
    description: "How efficiently does energy travel to the barrel?",
    icon: Activity,
    score: 55,
  },
  {
    key: "ball",
    name: "BALL",
    tagline: "Output Consistency",
    description: "How consistent is your power output swing after swing?",
    icon: TrendingUp,
    score: 51,
  },
];

// Leak types
const leakTypes = [
  {
    name: "Late Legs",
    description: "Your legs fired after your hands moved. You're swinging with arms, not your whole body.",
    color: "from-red-500 to-red-600",
  },
  {
    name: "Early Arms",
    description: "Your arms took over before your legs finished. You're cutting off your power source.",
    color: "from-orange-500 to-orange-600",
  },
  {
    name: "Torso Bypass",
    description: "Energy jumped from legs to arms, skipping your core. Your core isn't amplifying power.",
    color: "from-yellow-500 to-yellow-600",
  },
  {
    name: "Lost in Translation",
    description: "Energy didn't make it to the barrel. You're generating power but not delivering it.",
    color: "from-purple-500 to-purple-600",
  },
];

// How It Works steps
const howItWorksSteps = [
  { number: 1, title: "Capture", description: "Record your swings with video or sensor", icon: "📹" },
  { number: 2, title: "Score", description: "Get your 4B scores on the 20-80 scale", icon: "⚙️" },
  { number: 3, title: "Find Leak", description: "Pinpoint where energy is escaping", icon: "🔍" },
  { number: 4, title: "Prescribe Fix", description: "Get drills matched to your leak", icon: "🎯" },
  { number: 5, title: "Train & Improve", description: "Track progress over time", icon: "📈" },
];

// Differentiation points
const differentiationPoints = [
  { theirs: "They measure bat speed.", ours: "We measure what your body is capable of producing." },
  { theirs: "They track results.", ours: "We find the leaks preventing better results." },
  { theirs: "They tell you what happened.", ours: "We prescribe the drills to get you there." },
  { theirs: "They require manual uploads.", ours: "We auto-sync your sessions. Just train." },
];

// Who this is for / not for
const forPlayers = [
  "Players who want real feedback",
  "You're tired of random drills and want direction",
  "You want truth, not validation",
  "You want coaching — not just data",
];

const notForPlayers = [
  "You want shortcuts or gimmicks",
  "You're not willing to put in the work",
  "You expect results without reps",
  "You expect in-person access year-round",
];

// Gauge component for 20-80 scale
function ScoreGauge({ score, label }: { score: number; label: string }) {
  const percentage = ((score - 20) / 60) * 100;
  const getColor = () => {
    if (score >= 70) return "text-teal-400";
    if (score >= 60) return "text-emerald-400";
    if (score >= 50) return "text-yellow-400";
    if (score >= 40) return "text-orange-400";
    return "text-red-400";
  };
  
  return (
    <div className="relative w-24 h-24 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        {/* Background circle */}
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-slate-700"
        />
        {/* Progress circle */}
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${percentage * 2.51} 251`}
          className={getColor()}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-2xl font-black ${getColor()}`}>{score}</span>
      </div>
    </div>
  );
}

export default function Index() {
  const [loadingTier, setLoadingTier] = useState<string | null>(null);

  const handleSubscriptionCheckout = async (priceType: 'academy' | 'inner-circle') => {
    setLoadingTier(priceType);
    try {
      const { data, error } = await supabase.functions.invoke('create-subscription-checkout', {
        body: { priceType },
      });
      
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error('Failed to start checkout. Please try again.');
    } finally {
      setLoadingTier(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <Header />

      {/* ===== HERO SECTION ===== */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
        {/* Video Background */}
        <div className="absolute inset-0">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
          >
            <source src="/videos/hero-swing.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/95 to-slate-950/80" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="max-w-3xl">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20 mb-6">
              <Target className="w-4 h-4 text-red-400" />
              <span className="text-sm font-bold text-red-400 uppercase tracking-wider">
                4B Bio-Engine
              </span>
            </div>

            <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-white mb-6 tracking-tight leading-[1.1]">
              UNLOCK YOUR SWING'S{" "}
              <span className="text-red-500">HIDDEN POTENTIAL</span>
            </h1>

            <p className="text-xl md:text-2xl text-slate-300 mb-8 max-w-2xl leading-relaxed">
              The 4B Bio-Engine measures capability, not just results. Find the hidden leaks in your kinetic chain.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex flex-col">
                <Button
                  asChild
                  size="lg"
                  className="bg-red-600 hover:bg-red-700 text-white font-bold h-14 px-8 text-lg"
                >
                  <Link to="/diagnostic">
                    Get My 4B Analysis
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Link>
                </Button>
                <span className="text-sm text-slate-500 mt-2 text-center">
                  Free • See your scores in minutes
                </span>
              </div>
              <Button
                asChild
                size="lg"
                className="border border-slate-600 bg-transparent text-white hover:bg-slate-800 h-14 px-8 text-lg font-bold"
              >
                <Link to="/coaching">
                  Start Online Coaching
                </Link>
              </Button>
            </div>

            {/* Trust Stats */}
            <div className="flex items-center gap-8 mt-10">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">78+</div>
                <div className="text-sm text-slate-400">Pro Players</div>
              </div>
              <div className="w-px h-10 bg-slate-700" />
              <div className="text-center">
                <div className="text-2xl font-bold text-white">400+</div>
                <div className="text-sm text-slate-400">College Commits</div>
              </div>
              <div className="w-px h-10 bg-slate-700" />
              <div className="text-center">
                <div className="text-2xl font-bold text-white">MLB</div>
                <div className="text-sm text-slate-400">Hitting Coach</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== 4B BIO-ENGINE SECTION ===== */}
      <section className="py-20 bg-slate-900/50 border-y border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-block px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-lg mb-4">
              <span className="text-sm font-bold text-red-400 uppercase tracking-widest">The 4B Bio-Engine</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
              FOUR DIMENSIONS OF SWING POTENTIAL
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Measured on the professional 20-80 scout scale. The same system MLB scouts use to evaluate talent.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {fourBCards.map((card) => (
              <div
                key={card.key}
                className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 text-center hover:border-red-500/50 transition-colors"
              >
                <card.icon className="w-8 h-8 text-red-400 mx-auto mb-4" />
                <h3 className="text-xl font-black text-white mb-1">{card.name}</h3>
                <p className="text-sm text-red-400 font-medium mb-4">{card.tagline}</p>
                <ScoreGauge score={card.score} label={card.name} />
                <p className="text-sm text-slate-400 mt-4">{card.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FIND YOUR LEAK SECTION ===== */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
              FIND YOUR LEAK
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Every hitter has one. Energy should flow like a whip — when that chain breaks, you lose power. We pinpoint exactly where.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {leakTypes.map((leak, i) => (
              <div
                key={i}
                className="relative bg-slate-900/80 border border-slate-800 rounded-2xl p-6 overflow-hidden group hover:border-slate-600 transition-colors"
              >
                <div className={`absolute top-0 left-0 w-1 h-full bg-gradient-to-b ${leak.color}`} />
                <h3 className="text-lg font-bold text-white mb-2">{leak.name}</h3>
                <p className="text-sm text-slate-400">{leak.description}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <Button
              asChild
              className="bg-red-600 hover:bg-red-700 text-white font-bold h-12 px-8"
            >
              <Link to="/diagnostic">
                Find My Leak
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section className="py-20 bg-slate-900/50 border-y border-slate-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
              HOW IT WORKS
            </h2>
            <p className="text-lg text-slate-400">
              From swing capture to personalized training — fully automated.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-6">
            {howItWorksSteps.map((step) => (
              <div key={step.number} className="text-center">
                <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">{step.icon}</span>
                </div>
                <div className="text-red-400 font-bold text-sm mb-1">Step {step.number}</div>
                <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
                <p className="text-sm text-slate-400">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== NOT ANOTHER BAT SPEED APP ===== */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
              NOT ANOTHER BAT SPEED APP
            </h2>
            <p className="text-lg text-slate-400">
              Potential, not performance. Capability, not outcome. Coaching, not just data.
            </p>
          </div>

          <div className="space-y-4">
            {differentiationPoints.map((point, i) => (
              <div
                key={i}
                className="grid md:grid-cols-2 gap-4"
              >
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 flex items-start gap-3">
                  <X className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-400">{point.theirs}</span>
                </div>
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-5 flex items-start gap-3">
                  <Check className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <span className="text-white">{point.ours}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FREE DIAGNOSTIC CTA ===== */}
      <section className="py-20 bg-slate-900/30 border-y border-slate-800">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-full mb-6">
            <MessageCircle className="w-4 h-4 text-red-400" />
            <span className="text-sm font-bold text-red-400 uppercase tracking-wider">Start Here</span>
          </div>

          <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
            GET YOUR 4B ANALYSIS
          </h2>
          <p className="text-lg text-slate-400 mb-8 max-w-xl mx-auto">
            Find your leak. Get your scores. See what's holding you back — and what to fix first.
          </p>

          <Button
            asChild
            size="lg"
            className="bg-red-600 hover:bg-red-700 text-white font-bold h-14 px-10 text-lg"
          >
            <Link to="/diagnostic">
              Get My Free Analysis
              <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
          </Button>
        </div>
      </section>

      {/* ===== CHOOSE YOUR PATH (PRICING) ===== */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-3">
              ELITE TRAINING. SIMPLE PRICING.
            </h2>
            <p className="text-lg text-slate-400">No complicated tiers. Just results.</p>
          </div>

          {/* 3 Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-6 items-start">
            {/* Card 1 — Kinetic DNA Diagnostic (Free) */}
            <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-6 flex flex-col">
              <div className="text-teal-400 font-bold text-xs uppercase tracking-wider mb-2">Start Here</div>
              <h3 className="text-xl font-bold text-white mb-2">Kinetic DNA Diagnostic</h3>
              <div className="text-4xl font-black text-white mb-1">FREE</div>
              <div className="text-slate-500 mb-6">one-time</div>
              <ul className="text-left space-y-2 mb-6 flex-grow text-sm">
                <li className="flex items-start gap-2 text-slate-300">
                  <Check className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" />
                  Full 4B Score Analysis
                </li>
                <li className="flex items-start gap-2 text-slate-300">
                  <Check className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" />
                  Leak Detection Report
                </li>
                <li className="flex items-start gap-2 text-slate-300">
                  <Check className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" />
                  Motor Profile Assessment
                </li>
              </ul>
              <Button asChild className="w-full border border-slate-600 bg-transparent hover:bg-slate-800 text-white font-bold">
                <Link to="/diagnostic">Get Your Free Diagnostic</Link>
              </Button>
            </div>

            {/* Card 2 — The Academy ($99/mo) - FEATURED */}
            <div className="relative bg-slate-900/80 border-2 border-teal-500 rounded-2xl p-6 text-center flex flex-col shadow-lg shadow-teal-500/20 ring-4 ring-teal-500/30 scale-105 md:-mt-4 md:mb-4">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-teal-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                  Most Popular
                </span>
              </div>
              <div className="text-teal-400 font-bold text-xs uppercase tracking-wider mb-2 mt-2">Full Access</div>
              <h3 className="text-xl font-bold text-white mb-2">The Academy</h3>
              <div className="text-4xl font-black text-white mb-1">$99</div>
              <div className="text-slate-500 mb-6">/month</div>
              <ul className="text-left space-y-2 mb-6 flex-grow text-sm">
                <li className="flex items-start gap-2 p-2 bg-gradient-to-r from-amber-500/20 to-orange-500/10 border border-amber-500/40 rounded-lg">
                  <span className="text-amber-300 font-bold text-xs">🎁 FREE Smart Sensor Kit</span>
                </li>
                <li className="flex items-start gap-2 text-slate-300">
                  <Check className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" />
                  Daily Kinetic DNA Tracking
                </li>
                <li className="flex items-start gap-2 text-slate-300">
                  <Check className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" />
                  Automated Drill Prescription
                </li>
                <li className="flex items-start gap-2 text-slate-300">
                  <Check className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" />
                  Progress Tracking Dashboard
                </li>
                <li className="flex items-start gap-2 text-slate-300">
                  <Check className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" />
                  Weekly Coach Check-ins
                </li>
              </ul>
              <Button 
                onClick={() => handleSubscriptionCheckout('academy')}
                disabled={loadingTier === 'academy'}
                className="w-full bg-teal-500 hover:bg-teal-600 text-white font-bold"
              >
                {loadingTier === 'academy' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Join The Academy"
                )}
              </Button>
            </div>

            {/* Card 3 — Private Coaching ($199/mo) */}
            <div className="bg-slate-900/80 border border-amber-500/40 rounded-2xl p-6 flex flex-col">
              <div className="text-amber-400 font-bold text-xs uppercase tracking-wider mb-2">VIP Access</div>
              <h3 className="text-xl font-bold text-white mb-2">Private Coaching</h3>
              <div className="text-4xl font-black text-white mb-1">$199</div>
              <div className="text-slate-500 mb-6">/month</div>
              <ul className="text-left space-y-2 mb-6 flex-grow text-sm">
                <li className="flex items-start gap-2 text-slate-300">
                  <Check className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  Everything in The Academy
                </li>
                <li className="flex items-start gap-2 text-slate-300">
                  <Check className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  Monthly 1:1 Zoom Sessions
                </li>
                <li className="flex items-start gap-2 text-slate-300">
                  <Check className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  Priority Video Analysis
                </li>
                <li className="flex items-start gap-2 text-slate-300">
                  <Check className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  Direct Text Access to Coach
                </li>
              </ul>
              <div className="text-xs text-amber-400/70 mb-4 text-center">Limited to 20 players</div>
              <Button 
                onClick={() => handleSubscriptionCheckout('inner-circle')}
                disabled={loadingTier === 'inner-circle'}
                className="w-full border border-amber-500/40 bg-transparent hover:bg-amber-500/10 text-white font-bold"
              >
                {loadingTier === 'inner-circle' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Apply for Private Coaching"
                )}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ===== IS THIS FOR YOU? ===== */}
      <section className="py-20 bg-slate-900/30 border-y border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-12 text-center">
            IS THIS FOR YOU?
          </h2>

          <div className="grid md:grid-cols-2 gap-8">
            {/* For */}
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-emerald-400 mb-4 flex items-center gap-2">
                <Check className="w-5 h-5" />
                This is for you if...
              </h3>
              <ul className="space-y-3">
                {forPlayers.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-slate-300">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-1" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Not For */}
            <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-red-400 mb-4 flex items-center gap-2">
                <X className="w-5 h-5" />
                This is NOT for you if...
              </h3>
              <ul className="space-y-3">
                {notForPlayers.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-slate-300">
                    <X className="w-4 h-4 text-red-400 flex-shrink-0 mt-1" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FINAL CTA ===== */}
      <section className="py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
            READY TO UNLOCK YOUR POTENTIAL?
          </h2>
          <p className="text-lg text-slate-400 mb-8">
            Stop guessing. Start catching barrels.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              asChild
              size="lg"
              className="bg-red-600 hover:bg-red-700 text-white font-bold h-14 px-10 text-lg"
            >
              <Link to="/diagnostic">
                Get My 4B Analysis
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              className="border border-slate-600 bg-transparent text-white hover:bg-slate-800 h-14 px-8 text-lg font-bold"
            >
              <Link to="/coaching">
                Explore Coaching
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
