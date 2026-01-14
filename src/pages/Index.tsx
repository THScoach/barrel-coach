import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { 
  ArrowRight, 
  Target, 
  Compass, 
  Users, 
  Zap,
  Check,
  X,
  MessageCircle,
  MapPin
} from "lucide-react";
import { Link } from "react-router-dom";

// SCOREBOARD cards - ESPN style
const scoreboardCards = [
  {
    title: "CLARITY",
    description: "Know exactly what's broken — and why.",
    icon: Target,
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
  },
  {
    title: "DIRECTION",
    description: "One priority. One path. No noise.",
    icon: Compass,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
  },
  {
    title: "ACCOUNTABILITY",
    description: "Weekly check-ins. Real benchmarks. No hiding.",
    icon: Users,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
  },
  {
    title: "GAME TRANSFER",
    description: "Practice performance that shows up when it counts.",
    icon: Zap,
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
  },
];

// Who this is for / not for
const forPlayers = [
  "Players who want real feedback",
  "You're tired of random drills and want direction",
  "You want truth, not validation",
  "You want coaching — not just drills or opinions",
];

const notForPlayers = [
  "You want shortcuts or gimmicks",
  "You're not willing to put in the work",
  "You expect results without reps",
  "You expect in-person access year-round",
];

export default function Index() {
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
                MLB Hitting Coach
              </span>
            </div>

            <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-white mb-6 tracking-tight leading-[1.1]">
              STOP GUESSING.{" "}
              <span className="text-red-500">START CATCHING BARRELS.</span>
            </h1>

            <p className="text-xl md:text-2xl text-slate-300 mb-4 max-w-2xl leading-relaxed">
              I'm Rick Strickland. I've coached thousands of hitters.
            </p>
            <p className="text-lg text-slate-400 mb-8 max-w-2xl">
              This is how I coach when I'm not standing next to you — clear direction, one priority at a time.
            </p>

            {/* CTAs — Primary: Get Your First Fix */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex flex-col">
                <Button
                  asChild
                  size="lg"
                  className="bg-red-600 hover:bg-red-700 text-white font-bold h-14 px-8 text-lg"
                >
                  <Link to="/diagnostic">
                    Get Your First Fix
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Link>
                </Button>
                <span className="text-sm text-slate-500 mt-2 text-center">
                  Upload one swing. I'll show you what's leaking power.
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-4 sm:mt-0 sm:ml-4 self-center">
                Digital coaching. Real accountability. Seasonal in-person options.
              </p>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-slate-600 text-white hover:bg-slate-800 h-14 px-8 text-lg"
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

      {/* ===== HOW IT WORKS ===== */}
      <section className="py-20 bg-slate-900/50 border-y border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-12 text-center">
            HOW THIS WORKS
          </h2>
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div className="space-y-4">
              <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto">
                <span className="text-2xl font-black text-red-400">1</span>
              </div>
              <h3 className="text-xl font-bold text-white">Upload your swing</h3>
              <p className="text-slate-400">Send me a video. Side angle. That's it.</p>
            </div>
            <div className="space-y-4">
              <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto">
                <span className="text-2xl font-black text-red-400">2</span>
              </div>
              <h3 className="text-xl font-bold text-white">Get the truth</h3>
              <p className="text-slate-400">I'll tell you what's actually happening. No sugarcoating.</p>
            </div>
            <div className="space-y-4">
              <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto">
                <span className="text-2xl font-black text-red-400">3</span>
              </div>
              <h3 className="text-xl font-bold text-white">Fix what's holding you back</h3>
              <p className="text-slate-400">One clear priority. One path forward.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== WHAT YOU GET ===== */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4 text-center">
            WHAT YOU GET
          </h2>
          <p className="text-xl text-slate-400 text-center mb-12">
            No charts. No noise. Just direction.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { label: "MOTOR PROFILE", desc: "How your body naturally moves" },
              { label: "POWER LEAK", desc: "Where your power is bleeding out" },
              { label: "FIRST FIX", desc: "The one thing to fix first" },
              { label: "WHAT NOT TO CHANGE", desc: "What's already working for you" },
              { label: "MATCHED DRILLS", desc: "Drills matched to your swing" },
              { label: "COACH EXPLANATION", desc: "Short voice or video from Rick" },
            ].map((item, i) => (
              <div key={i} className="bg-slate-900/80 border border-slate-800 rounded-xl p-6">
                <div className="text-red-400 font-bold text-sm uppercase tracking-wider mb-2">
                  {item.label}
                </div>
                <p className="text-slate-300">{item.desc}</p>
              </div>
            ))}
          </div>

          <p className="text-center text-slate-400 mt-10 text-lg">
            Everything I do runs through the <strong className="text-white">4B System™</strong> — Body, Bat, Ball, Brain. It's how I've diagnosed hitters for 25+ years.
          </p>
        </div>
      </section>

      {/* ===== SCOREBOARD SECTION ===== */}
      <section className="py-20 bg-slate-900/30 border-y border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-block px-4 py-2 bg-slate-800 rounded-lg mb-4">
              <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">SCOREBOARD</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-white">
              WHAT YOU'RE PLAYING FOR
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {scoreboardCards.map((card, i) => (
              <div
                key={i}
                className={`relative p-6 rounded-2xl ${card.bg} border ${card.border} backdrop-blur-sm`}
              >
                <card.icon className={`w-8 h-8 ${card.color} mb-4`} />
                <h3 className="text-xl font-black text-white mb-2">{card.title}</h3>
                <p className="text-slate-400 text-sm">{card.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FREE DIAGNOSTIC CTA ===== */}
      <section className="py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-full mb-6">
            <MessageCircle className="w-4 h-4 text-red-400" />
            <span className="text-sm font-bold text-red-400 uppercase tracking-wider">Start Here</span>
          </div>

          <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
            GET YOUR FIRST FIX
          </h2>
          <p className="text-lg text-slate-400 mb-4">
            Upload your swing. I'll show you what's leaking power and what to fix first.
          </p>
          <p className="text-slate-500 mb-8 text-sm italic">
            This isn't a score. It's a direction.
          </p>

          <Button
            asChild
            size="lg"
            className="bg-red-600 hover:bg-red-700 text-white font-bold h-14 px-10 text-lg"
          >
            <Link to="/diagnostic">
              Get Your First Fix
              <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
          </Button>
        </div>
      </section>

      {/* ===== CHOOSE YOUR PATH ===== */}
      <section className="py-20 bg-slate-900/50 border-y border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
              CHOOSE YOUR PATH
            </h2>
            <p className="text-lg text-slate-400">Start free. Go deeper when you're ready.</p>
          </div>

          {/* Main 3 Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {/* Card 1 — Free Diagnostic */}
            <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-6 text-center hover:-translate-y-1 transition-transform flex flex-col">
              <div className="text-slate-400 font-bold text-sm uppercase tracking-wider mb-2">Start Here</div>
              <h3 className="text-xl font-bold text-white mb-2">Free Diagnostic</h3>
              <div className="text-4xl font-black text-white mb-1">$0</div>
              <div className="text-slate-500 mb-4">one-time</div>
              <p className="text-emerald-400 text-sm font-medium mb-4 italic">Clarity before commitment</p>
              <ul className="text-left space-y-2 mb-6 flex-grow text-sm">
                <li className="flex items-start gap-2 text-slate-300">
                  <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                  Upload a swing
                </li>
                <li className="flex items-start gap-2 text-slate-300">
                  <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                  Short analysis from Rick
                </li>
                <li className="flex items-start gap-2 text-slate-300">
                  <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                  Delivered via SMS
                </li>
              </ul>
              <p className="text-xs text-slate-500 mb-4 border-t border-slate-800 pt-4">
                Delivered via SMS. No drills. No guessing.
              </p>
              <Button asChild className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold">
                <Link to="/diagnostic">Get Your First Fix</Link>
              </Button>
            </div>

            {/* Card 2 — $37 KRS Assessment */}
            <div className="bg-slate-900/80 border border-blue-500/30 rounded-2xl p-6 text-center hover:-translate-y-1 transition-transform flex flex-col">
              <div className="text-blue-400 font-bold text-sm uppercase tracking-wider mb-2">One-Time</div>
              <h3 className="text-xl font-bold text-white mb-2">KRS Assessment</h3>
              <div className="text-4xl font-black text-white mb-1">$37</div>
              <div className="text-slate-500 mb-4">one-time</div>
              <p className="text-blue-400 text-sm font-medium mb-4 italic">Full swing direction + fix order</p>
              <ul className="text-left space-y-2 mb-6 flex-grow text-sm">
                <li className="flex items-start gap-2 text-slate-300">
                  <Check className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  Full KRS 4B Report
                </li>
                <li className="flex items-start gap-2 text-slate-300">
                  <Check className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  AI-powered explanation
                </li>
                <li className="flex items-start gap-2 text-slate-300">
                  <Check className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  Starter drills included
                </li>
              </ul>
              <p className="text-xs text-slate-500 mb-4 border-t border-slate-800 pt-4">
                This is an assessment — not ongoing coaching.
              </p>
              <Button asChild className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold">
                <Link to="/diagnostic">Get KRS Assessment</Link>
              </Button>
            </div>

            {/* Card 3 — Catching Barrels Membership (FEATURED) */}
            <div className="bg-slate-900/80 border-2 border-red-500/50 rounded-2xl p-6 text-center relative hover:-translate-y-1 transition-transform flex flex-col ring-2 ring-red-500/30">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-red-600 rounded-full text-xs font-bold text-white uppercase tracking-wider">
                Most Popular
              </div>
              <div className="text-red-400 font-bold text-sm uppercase tracking-wider mb-2 mt-2">Ongoing</div>
              <h3 className="text-xl font-bold text-white mb-2">Catching Barrels Membership</h3>
              <div className="text-4xl font-black text-white mb-1">$99<span className="text-lg text-slate-400">/mo</span></div>
              <div className="text-sm text-yellow-400 mb-1">or $899/year (save ~24%)</div>
              <div className="text-slate-500 text-xs mb-4">Founding annual rate – until March 1</div>
              <ul className="text-left space-y-2 mb-4 flex-grow text-sm">
                <li className="flex items-start gap-2 text-slate-300">
                  <Check className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  1 structured swing review per month
                </li>
                <li className="flex items-start gap-2 text-slate-300">
                  <Check className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  KRS reports included
                </li>
                <li className="flex items-start gap-2 text-slate-300">
                  <Check className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  Weekly group coaching calls
                </li>
                <li className="flex items-start gap-2 text-slate-300">
                  <Check className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  Rick AI + My Swing Lab access
                </li>
                <li className="flex items-start gap-2 text-slate-300">
                  <Check className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  Clear priorities, not drill overload
                </li>
              </ul>
              <p className="text-xs text-slate-500 mb-4 border-t border-slate-800 pt-4">
                Built for hitters who want ongoing correction and accountability — not just answers.<br />
                <span className="text-slate-400">Membership can be paused anytime.</span>
              </p>
              <Button asChild className="w-full bg-red-600 hover:bg-red-700 text-white font-bold">
                <Link to="/coaching">Join Membership</Link>
              </Button>
            </div>
          </div>

          {/* Additional Options Row */}
          <div className="grid md:grid-cols-2 gap-6 mt-8">
            {/* In-Person Session Card */}
            <div className="bg-slate-900/80 border border-amber-500/30 rounded-2xl p-6 flex flex-col md:flex-row items-start gap-6">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-amber-400" />
                </div>
              </div>
              <div className="flex-grow">
                <div className="text-amber-400 font-bold text-xs uppercase tracking-wider mb-1">Limited Availability</div>
                <h3 className="text-lg font-bold text-white mb-1">In-Person Swing Session</h3>
                <div className="text-2xl font-black text-white mb-2">$399</div>
                <ul className="space-y-1 text-sm text-slate-300 mb-3">
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    1 in-person swing session
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    High-speed video + breakdown
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    Clear correction priorities
                  </li>
                </ul>
                <p className="text-xs text-amber-400/80 mb-4">
                  Available seasonally (October–February) or limited dates during spring training.
                </p>
                <Button asChild variant="outline" className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10">
                  <a href="mailto:rick@catchingbarrels.io?subject=In-Person Session Request">Request In-Person Session</a>
                </Button>
              </div>
            </div>

            {/* Transformation Program Card (Pre-written, waitlist) */}
            <div className="bg-slate-900/80 border border-purple-500/30 rounded-2xl p-6 flex flex-col md:flex-row items-start gap-6 opacity-90">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-purple-400" />
                </div>
              </div>
              <div className="flex-grow">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-purple-400 font-bold text-xs uppercase tracking-wider">Off-Season</span>
                  <span className="text-xs font-bold text-purple-400 bg-purple-500/20 px-2 py-0.5 rounded">Opens October</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-1">Transformation Program</h3>
                <ul className="space-y-1 text-sm text-slate-300 mb-3">
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                    Multi-month swing rebuild
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                    Structured progression plan
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                    Multiple swing reviews
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                    Accountability + checkpoints
                  </li>
                </ul>
                <p className="text-xs text-purple-400/80 mb-4">
                  Offered October–February only. Designed for real change, not quick fixes.
                </p>
                <Button asChild variant="outline" className="border-purple-500/50 text-purple-400 hover:bg-purple-500/10">
                  <a href="mailto:rick@catchingbarrels.io?subject=Transformation Program Waitlist">Join Waitlist</a>
                </Button>
              </div>
            </div>
          </div>

          {/* Availability Notice */}
          <div className="mt-10 text-center">
            <p className="text-sm text-slate-500">
              <strong className="text-slate-400">Availability Note:</strong> All programs are currently delivered digitally. In-person coaching is offered seasonally (October–February) or by limited availability.
            </p>
          </div>
        </div>
      </section>

      {/* ===== WHO THIS IS FOR / NOT FOR ===== */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-12 text-center">
            IS THIS FOR YOU?
          </h2>

          <div className="grid md:grid-cols-2 gap-8">
            {/* For */}
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-8">
              <h3 className="text-xl font-bold text-emerald-400 mb-6 flex items-center gap-2">
                <Check className="w-6 h-6" />
                THIS IS FOR YOU IF...
              </h3>
              <ul className="space-y-4">
                {forPlayers.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-slate-300">
                    <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Not For */}
            <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-8">
              <h3 className="text-xl font-bold text-red-400 mb-6 flex items-center gap-2">
                <X className="w-6 h-6" />
                THIS IS NOT FOR YOU IF...
              </h3>
              <ul className="space-y-4">
                {notForPlayers.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-slate-300">
                    <X className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CLOSING CTA ===== */}
      <section className="py-20 bg-gradient-to-b from-slate-900 to-slate-950 border-t border-slate-800">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
            I'M NOT SELLING DRILLS.
          </h2>
          <p className="text-2xl text-slate-300 mb-8">
            I'm selling coaching.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              asChild
              size="lg"
              className="bg-red-600 hover:bg-red-700 text-white font-bold h-14 px-10 text-lg"
            >
              <Link to="/diagnostic">
                Get Free Diagnostic
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-slate-600 text-white hover:bg-slate-800 h-14 px-10 text-lg"
            >
              <Link to="/coaching">
                Start Coaching
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
