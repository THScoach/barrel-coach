import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { ArrowRight, Upload, Brain, Target, Zap, Activity, Flame, Crosshair, Gauge, Wind, Scissors, Unplug, Instagram, Twitter, Mail } from "lucide-react";
import { CoachRickSection } from "@/components/landing/CoachRickSection";
import { MLBTechnologySection } from "@/components/landing/MLBTechnologySection";
import { TestimonialsSection } from "@/components/landing/TestimonialsSection";

const PILLARS = [
  {
    label: "BODY",
    icon: Zap,
    description: "How your structure generates and transfers force through the kinetic chain",
  },
  {
    label: "BRAIN",
    icon: Brain,
    description: "Your timing, tempo, and decision patterns under pressure",
  },
  {
    label: "BAT",
    icon: Target,
    description: "How you deliver the barrel to the zone with precision",
  },
  {
    label: "BALL",
    icon: Upload,
    description: "What your swing actually produces — exit velo, launch angle, contact quality",
  },
];

const ARCHETYPES = [
  { name: "Bomber", icon: Flame, description: "Max force, ground-up power chain", color: "from-red-600 to-orange-500" },
  { name: "Machine", icon: Gauge, description: "Repeatable, mechanically efficient", color: "from-blue-600 to-cyan-500" },
  { name: "Loader", icon: Activity, description: "Deep load, explosive release", color: "from-purple-600 to-pink-500" },
  { name: "Assassin", icon: Crosshair, description: "Quick, direct barrel path", color: "from-emerald-600 to-green-500" },
  { name: "Volcano", icon: Flame, description: "Stored energy, violent eruption", color: "from-orange-600 to-yellow-500" },
  { name: "Surgeon", icon: Scissors, description: "Precision contact, zone command", color: "from-sky-600 to-indigo-500" },
  { name: "Disconnected", icon: Unplug, description: "Energy leaks — fixable with the right plan", color: "from-slate-600 to-slate-500" },
];

const STATS = [
  { value: "400+", label: "College commits coached" },
  { value: "100+", label: "Professional players" },
  { value: ".094 → All-Star", label: "Cedric Mullins transformation" },
];

const STEPS = [
  {
    number: "1",
    title: "Upload your swing",
    detail: "Phone camera works. Our system processes your movement against Reboot Motion biomechanics benchmarks.",
  },
  {
    number: "2",
    title: "Discover your Energy Archetype",
    detail: "Get classified as a Bomber, Machine, Loader, Assassin, Volcano, Surgeon, or Disconnected — and understand exactly how your body generates power.",
  },
  {
    number: "3",
    title: "Get your prescription",
    detail: "Coach Rick AI delivers a drill program built for your archetype, your 4B scores, and your predicted contact outcomes.",
  },
];

const PLANS = [
  { name: "Free Diagnostic", price: "Free", line: "Kinetic DNA Profile + PDF report" },
  { name: "Starter", price: "$49/mo", line: "Full drill library — BYOS" },
  { name: "Academy", price: "$99/mo", line: "Sensor kit + weekly coaching" },
  { name: "Elite", price: "$199/mo", line: "1:1 Zoom + direct text access" },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* ─── NAV ─── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14 sm:h-16">
          <Logo />
          <div className="flex items-center gap-4 sm:gap-6">
            <Link to="/athletes" className="text-xs sm:text-sm text-slate-400 hover:text-white transition-colors">
              Athletes
            </Link>
            <Link to="/pricing" className="text-xs sm:text-sm text-slate-400 hover:text-white transition-colors">
              Plans
            </Link>
            <Link to="/login" className="text-xs sm:text-sm text-slate-400 hover:text-white transition-colors">
              Login
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section className="relative pt-24 sm:pt-32 pb-16 sm:pb-24 overflow-hidden">
        {/* Ambient glow effects */}
        <div className="absolute top-0 right-0 w-[300px] sm:w-[600px] h-[300px] sm:h-[600px] bg-red-600/10 rounded-full blur-[120px] sm:blur-[160px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[200px] sm:w-[400px] h-[200px] sm:h-[400px] bg-red-600/5 rounded-full blur-[80px] sm:blur-[120px] translate-y-1/2 -translate-x-1/3 pointer-events-none" />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-8 text-center">
          {/* Authority badge */}
          <div className="inline-flex items-center gap-2 bg-slate-800/60 border border-slate-700/50 rounded-full px-3 sm:px-4 py-1.5 mb-6 sm:mb-8">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-[10px] sm:text-xs font-medium text-slate-300 tracking-wide uppercase">
              Built by an Active AAA Hitting Coach
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-7xl font-black leading-[1.1] mb-5 sm:mb-6 tracking-tight">
            Stop Guessing.{" "}
            <span className="bg-gradient-to-r from-red-500 to-red-400 bg-clip-text text-transparent">
              Start Catching Barrels.
            </span>
          </h1>

          <p className="text-base sm:text-lg md:text-xl text-slate-400 max-w-3xl mx-auto mb-8 sm:mb-10 leading-relaxed">
            The only hitting platform powered by{" "}
            <span className="text-white font-semibold">Reboot Motion biomechanics</span> — 
            classifying your energy archetype, scoring your swing across 4 pillars, 
            and predicting your batted ball outcomes.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Button asChild size="lg" className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-6 text-base sm:text-lg shadow-lg shadow-red-600/20">
              <Link to="/diagnostic" className="flex items-center justify-center gap-2">
                Get Your Free Diagnostic <ArrowRight className="w-5 h-5" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="w-full sm:w-auto border-slate-600 hover:bg-slate-800 text-white font-bold px-8 py-6 text-base sm:text-lg">
              <Link to="/pricing">View Plans</Link>
            </Button>
          </div>

          {/* Tech stack badges */}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mt-8 sm:mt-10">
            {["Reboot Motion Sensors", "4B Scoring Engine", "AI Drill Prescription"].map((badge) => (
              <span key={badge} className="text-[10px] sm:text-xs text-slate-500 border border-slate-800 rounded-full px-2.5 sm:px-3 py-1">
                {badge}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ─── THE PROBLEM ─── */}
      <section className="py-14 sm:py-20 bg-slate-900/60">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black mb-5 sm:mb-6">
            Most hitting instruction is built on{" "}
            <span className="text-red-500">observation, not data.</span>
          </h2>
          <p className="text-base sm:text-lg text-slate-400 leading-relaxed">
            Coaches teach the same cues to every hitter. You get generic feedback 
            that doesn't match your body type, your movement pattern, or your energy system. 
            Progress stalls — not because you're not working hard, but because no one has ever 
            actually <span className="text-white font-medium">read your swing</span>.
          </p>
        </div>
      </section>

      {/* ─── COACH RICK ─── */}
      <CoachRickSection />

      {/* ─── WHY COACH RICK (TECH) ─── */}
      <MLBTechnologySection />

      {/* ─── THE SOLUTION (4B Pillars) ─── */}
      <section className="py-14 sm:py-20">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-center mb-3 sm:mb-4">
            Your body has a blueprint.{" "}
            <span className="text-red-500">We read it.</span>
          </h2>
          <p className="text-slate-500 text-center mb-8 sm:mb-12 text-base sm:text-lg">The 4B System — powered by Reboot Motion biomechanics data</p>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {PILLARS.map((p) => (
              <div
                key={p.label}
                className="bg-slate-900 border border-slate-800 rounded-xl sm:rounded-2xl p-4 sm:p-6 text-center hover:border-red-500/40 transition-colors group"
              >
                <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl bg-red-600/10 flex items-center justify-center mx-auto mb-3 sm:mb-4 group-hover:bg-red-600/20 transition-colors">
                  <p.icon className="w-5 h-5 sm:w-7 sm:h-7 text-red-500" />
                </div>
                <h3 className="text-base sm:text-xl font-bold mb-1 sm:mb-2">{p.label}</h3>
                <p className="text-slate-400 text-xs sm:text-sm">{p.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── ENERGY ARCHETYPES ─── */}
      <section className="py-14 sm:py-20 bg-slate-900/40">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-center mb-3 sm:mb-4">
            Discover your{" "}
            <span className="text-red-500">Energy Archetype</span>
          </h2>
          <p className="text-slate-400 text-center mb-8 sm:mb-12 max-w-2xl mx-auto text-sm sm:text-base">
            Every hitter generates power differently. Our biomechanics engine classifies your 
            movement pattern into one of seven archetypes — so your training matches your body.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {ARCHETYPES.map((a) => (
              <div
                key={a.name}
                className="relative bg-slate-950 border border-slate-800 rounded-xl p-4 sm:p-5 hover:border-slate-600 transition-all group overflow-hidden"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${a.color} opacity-0 group-hover:opacity-[0.06] transition-opacity`} />
                <div className="relative">
                  <a.icon className="w-5 h-5 sm:w-6 sm:h-6 text-slate-500 group-hover:text-red-400 mb-2 sm:mb-3 transition-colors" />
                  <h3 className="font-bold text-white text-xs sm:text-sm mb-0.5 sm:mb-1">{a.name}</h3>
                  <p className="text-slate-500 text-[10px] sm:text-xs leading-relaxed">{a.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── RESULTS ─── */}
      <section className="py-14 sm:py-20 bg-gradient-to-b from-red-950/30 to-slate-950">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-xl sm:text-2xl font-bold text-center text-slate-300 mb-8 sm:mb-12">Proven Results</h2>
          <div className="grid grid-cols-3 gap-4 sm:gap-8 text-center">
            {STATS.map((s) => (
              <div key={s.label}>
                <p className="text-2xl sm:text-4xl md:text-5xl font-black text-white mb-1 sm:mb-2">{s.value}</p>
                <p className="text-slate-400 text-xs sm:text-base">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TESTIMONIALS ─── */}
      <TestimonialsSection />

      <section className="py-14 sm:py-20">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-center mb-8 sm:mb-12">
            How It Works
          </h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {STEPS.map((s) => (
              <div key={s.number} className="text-center">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-red-600 text-white text-xl sm:text-2xl font-black flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  {s.number}
                </div>
                <h3 className="text-base sm:text-lg font-bold mb-2">{s.title}</h3>
                <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">{s.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PRICING PREVIEW ─── */}
      <section className="py-20 bg-slate-900/60">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-black text-center mb-12">
            Simple Pricing
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {PLANS.map((p) => (
              <div
                key={p.name}
                className="bg-slate-950 border border-slate-800 rounded-xl p-5 text-center"
              >
                <h3 className="font-bold text-white mb-1">{p.name}</h3>
                <p className="text-2xl font-black text-red-500 mb-2">{p.price}</p>
                <p className="text-slate-400 text-xs">{p.line}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link to="/pricing" className="text-red-400 hover:text-red-300 text-sm font-semibold underline underline-offset-4">
              View full details →
            </Link>
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="py-24">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-black mb-8">
            Ready to know what's actually holding you back?
          </h2>
          <Button asChild size="lg" className="bg-red-600 hover:bg-red-700 text-white font-bold px-10 py-6 text-lg shadow-lg shadow-red-600/20">
            <Link to="/diagnostic" className="flex items-center gap-2">
              Start Free — No Credit Card <ArrowRight className="w-5 h-5" />
            </Link>
          </Button>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-slate-800 py-8">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-4">
            <Logo size="sm" />
            <span className="hidden sm:inline text-slate-600">|</span>
            <span className="hidden sm:inline text-slate-500 text-xs">Stop guessing. Start catching barrels.</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="https://www.instagram.com/catchingbarrels" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
              <Instagram className="w-4 h-4" />
            </a>
            <a href="https://x.com/catchingbarrels" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
              <Twitter className="w-4 h-4" />
            </a>
            <a href="mailto:swingrehabcoach@gmail.com" className="hover:text-white transition-colors">
              <Mail className="w-4 h-4" />
            </a>
            <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
            <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <Link to="/pricing" className="hover:text-white transition-colors">Pricing</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
