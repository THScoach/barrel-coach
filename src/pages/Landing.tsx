import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { ArrowRight, Upload, Brain, Target, Zap } from "lucide-react";

const PILLARS = [
  {
    label: "BODY",
    icon: Zap,
    description: "How your structure generates and transfers force",
  },
  {
    label: "BRAIN",
    icon: Brain,
    description: "Your timing, tempo, and decision patterns",
  },
  {
    label: "BAT",
    icon: Target,
    description: "How you deliver the barrel to the zone",
  },
  {
    label: "BALL",
    icon: Upload,
    description: "What your swing actually produces",
  },
];

const STATS = [
  { value: "400+", label: "College commits coached" },
  { value: "100+", label: "Professional players" },
  { value: ".094 → All-Star", label: "Cedric Mullins transformation" },
];

const STEPS = [
  { number: "1", title: "Upload your swing", detail: "Phone camera works" },
  { number: "2", title: "Get your Motor Profile", detail: "In minutes" },
  { number: "3", title: "Receive your drill prescription", detail: "From Coach Rick AI" },
];

const PLANS = [
  { name: "Free Diagnostic", price: "Free", line: "Motor Profile + PDF report" },
  { name: "Starter", price: "$49/mo", line: "Full drill library — BYOS" },
  { name: "Academy", price: "$99/mo", line: "Sensor kit + weekly coaching" },
  { name: "Elite", price: "$199/mo", line: "1:1 Zoom + direct text access" },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* ─── NAV ─── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <Logo />
          <div className="flex items-center gap-6">
            <Link to="/pricing" className="text-sm text-slate-400 hover:text-white transition-colors">
              Plans
            </Link>
            <Link to="/login" className="text-sm text-slate-400 hover:text-white transition-colors">
              Login
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        {/* Subtle red accent glow */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-red-600/10 rounded-full blur-[160px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />

        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black leading-tight mb-6">
            Stop Guessing.{" "}
            <span className="text-red-500">Start Catching Barrels.</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10">
            The only hitting platform built around YOUR movement — not a generic swing model.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button asChild size="lg" className="bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-6 text-lg">
              <Link to="/diagnostic" className="flex items-center gap-2">
                Get Your Free Diagnostic <ArrowRight className="w-5 h-5" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="border-slate-600 hover:bg-slate-800 text-white font-bold px-8 py-6 text-lg">
              <Link to="/pricing">View Plans</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ─── THE PROBLEM ─── */}
      <section className="py-20 bg-slate-900/60">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-black mb-6">
            Most coaching is <span className="text-red-500">guesswork.</span>
          </h2>
          <p className="text-lg text-slate-400 leading-relaxed">
            Coaches see what they expect to see. They teach the same swing to every hitter.
            Your kid gets generic cues that don't match their body. Progress stalls.
          </p>
        </div>
      </section>

      {/* ─── THE SOLUTION (4B Pillars) ─── */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-black text-center mb-4">
            Your body has a blueprint.{" "}
            <span className="text-red-500">We read it.</span>
          </h2>
          <p className="text-slate-500 text-center mb-12 text-lg">The 4B System</p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {PILLARS.map((p) => (
              <div
                key={p.label}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center hover:border-red-500/40 transition-colors"
              >
                <p.icon className="w-10 h-10 text-red-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">{p.label}</h3>
                <p className="text-slate-400 text-sm">{p.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── RESULTS ─── */}
      <section className="py-20 bg-gradient-to-b from-red-950/30 to-slate-950">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            {STATS.map((s) => (
              <div key={s.label}>
                <p className="text-4xl md:text-5xl font-black text-white mb-2">{s.value}</p>
                <p className="text-slate-400">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-black text-center mb-12">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {STEPS.map((s) => (
              <div key={s.number} className="text-center">
                <div className="w-14 h-14 rounded-full bg-red-600 text-white text-2xl font-black flex items-center justify-center mx-auto mb-4">
                  {s.number}
                </div>
                <h3 className="text-lg font-bold mb-1">{s.title}</h3>
                <p className="text-slate-400 text-sm">{s.detail}</p>
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
          <Button asChild size="lg" className="bg-red-600 hover:bg-red-700 text-white font-bold px-10 py-6 text-lg">
            <Link to="/diagnostic" className="flex items-center gap-2">
              Start Free — No Credit Card <ArrowRight className="w-5 h-5" />
            </Link>
          </Button>
        </div>
      </section>

      {/* ─── MINIMAL FOOTER ─── */}
      <footer className="border-t border-slate-800 py-8">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <Logo size="sm" />
          <div className="flex gap-6">
            <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
            <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <Link to="/pricing" className="hover:text-white transition-colors">Pricing</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
