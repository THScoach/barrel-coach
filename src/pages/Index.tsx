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
  MessageCircle
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
  "You're tired of random drills and want a real system",
  "You've hit a wall and can't figure out what's wrong",
  "You want truth, not validation",
];

const notForPlayers = [
  "You want someone to tell you you're great",
  "You're not willing to put in the work",
  "You expect results without reps",
];

export default function Index() {
  return (
    <div className="min-h-screen bg-slate-950">
      <Header />

      {/* ===== HERO SECTION - SCOREBOARD FEEL ===== */}
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
              I'm Rick Strickland — MLB hitting coach, former scout, and the guy who's helped 78+ pros and 400+ college commits find their swing.
            </p>
            <p className="text-lg text-slate-400 mb-8 max-w-2xl">
              This app is my second brain. It sees what I see. It tells you what I'd tell you in the cage.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                asChild
                size="lg"
                className="bg-red-600 hover:bg-red-700 text-white font-bold h-14 px-8 text-lg"
              >
                <Link to="/analyze">
                  Get Your Free Diagnostic
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-slate-600 text-white hover:bg-slate-800 h-14 px-8 text-lg"
              >
                <Link to="/assessment">
                  Book In-Person Assessment
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

      {/* ===== THE PROBLEM ===== */}
      <section className="py-20 bg-slate-900/50 border-y border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-8 text-center">
            THE PROBLEM
          </h2>
          <div className="space-y-6 text-lg text-slate-300">
            <p>
              <strong className="text-white">Players are drowning in noise.</strong> YouTube drills. Instagram tips. Tech that spits out numbers but no answers.
            </p>
            <p>
              You've got exit velo. You've got launch angle. You've got slow-mo video from four angles.
            </p>
            <p className="text-xl text-white font-semibold">
              But you still don't know what's actually wrong.
            </p>
            <p className="text-slate-400">
              That's because data without interpretation is just distraction. You don't need more information. You need someone who's seen 10,000 swings to tell you what matters.
            </p>
          </div>
        </div>
      </section>

      {/* ===== WHAT'S DIFFERENT HERE ===== */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4 text-center">
            WHAT'S DIFFERENT HERE
          </h2>
          <p className="text-xl text-slate-400 text-center mb-12">
            I don't start with drills. I start with truth.
          </p>

          <div className="grid sm:grid-cols-2 gap-6">
            {[
              { label: "MOVEMENT", desc: "How your body organizes force" },
              { label: "SEQUENCE", desc: "When each segment fires — and if it's costing you" },
              { label: "DECISION", desc: "What you're chasing and why" },
              { label: "CONTACT QUALITY", desc: "What happens when bat meets ball" },
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
            FREE DIAGNOSTIC
          </h2>
          <p className="text-lg text-slate-400 mb-4">
            Upload your swing. Get a no-BS snapshot of what's happening.
          </p>
          <p className="text-slate-500 mb-8 text-sm">
            This is a single response — not a back-and-forth conversation. It's clarity, not coaching.
          </p>

          <Button
            asChild
            size="lg"
            className="bg-red-600 hover:bg-red-700 text-white font-bold h-14 px-10 text-lg"
          >
            <Link to="/analyze">
              Get Your Free Diagnostic
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
              CHOOSE YOUR NEXT MOVE
            </h2>
            <p className="text-lg text-slate-400">Three paths. All lead to better at-bats.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Guided Coaching */}
            <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-8 text-center hover:-translate-y-1 transition-transform">
              <div className="text-blue-400 font-bold text-sm uppercase tracking-wider mb-2">Ongoing Structure</div>
              <h3 className="text-2xl font-bold text-white mb-2">Guided Coaching</h3>
              <div className="text-4xl font-black text-white mb-1">$99</div>
              <div className="text-slate-500 mb-6">/month</div>
              <ul className="text-left space-y-3 mb-8">
                <li className="flex items-start gap-3 text-slate-300">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  Weekly AI check-ins in Rick's voice
                </li>
                <li className="flex items-start gap-3 text-slate-300">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  Ongoing data uploads + trend tracking
                </li>
                <li className="flex items-start gap-3 text-slate-300">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  Clear benchmarks + accountability
                </li>
              </ul>
              <Button asChild className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold">
                <Link to="/inner-circle">Start Coaching</Link>
              </Button>
              <p className="text-xs text-slate-500 mt-4">Clarity becomes consistency.</p>
            </div>

            {/* In-Person Assessment */}
            <div className="bg-slate-900/80 border-2 border-red-500/50 rounded-2xl p-8 text-center relative hover:-translate-y-1 transition-transform">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-red-600 rounded-full text-xs font-bold text-white uppercase tracking-wider">
                Most Popular
              </div>
              <div className="text-red-400 font-bold text-sm uppercase tracking-wider mb-2">Truth Session</div>
              <h3 className="text-2xl font-bold text-white mb-2">In-Person Assessment</h3>
              <div className="text-4xl font-black text-white mb-1">$399</div>
              <div className="text-slate-500 mb-6">one-time</div>
              <ul className="text-left space-y-3 mb-8">
                <li className="flex items-start gap-3 text-slate-300">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  90 minutes with Rick, face-to-face
                </li>
                <li className="flex items-start gap-3 text-slate-300">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  Full 4B evaluation + video analysis
                </li>
                <li className="flex items-start gap-3 text-slate-300">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  30-day drill plan + follow-up support
                </li>
              </ul>
              <Button asChild className="w-full bg-red-600 hover:bg-red-700 text-white font-bold">
                <Link to="/assessment">Book Now</Link>
              </Button>
              <p className="text-xs text-slate-500 mt-4">One session. Real answers.</p>
            </div>

            {/* 90-Day Transformation */}
            <div className="bg-gradient-to-b from-slate-900 to-slate-900/80 border border-yellow-500/30 rounded-2xl p-8 text-center hover:-translate-y-1 transition-transform">
              <div className="text-yellow-400 font-bold text-sm uppercase tracking-wider mb-2">Flagship Program</div>
              <h3 className="text-2xl font-bold text-white mb-2">90-Day Transformation</h3>
              <div className="text-2xl font-black text-white mb-1">$1,997 – $2,997</div>
              <div className="text-slate-500 mb-6">by application</div>
              <ul className="text-left space-y-3 mb-8">
                <li className="flex items-start gap-3 text-slate-300">
                  <Check className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  Full assessment + structured training
                </li>
                <li className="flex items-start gap-3 text-slate-300">
                  <Check className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  Ongoing feedback loops + adjustments
                </li>
                <li className="flex items-start gap-3 text-slate-300">
                  <Check className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  Real change. Not a course.
                </li>
              </ul>
              <Button asChild className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold">
                <Link to="/apply">Apply Now</Link>
              </Button>
              <p className="text-xs text-slate-500 mt-4">For players done guessing.</p>
            </div>
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

      {/* ===== RICK SIGN-OFF ===== */}
      <section className="py-20 bg-gradient-to-b from-slate-900 to-slate-950 border-t border-slate-800">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="w-20 h-20 bg-slate-800 rounded-full mx-auto mb-8 flex items-center justify-center">
            <span className="text-3xl font-black text-white">RS</span>
          </div>

          <p className="text-xl text-slate-300 mb-6 leading-relaxed">
            "I've spent 25 years watching swings. Thousands of players. Hundreds of pros. I've seen every mistake, every compensation, every lie hitters tell themselves.
          </p>
          <p className="text-xl text-slate-300 mb-6 leading-relaxed">
            This app doesn't replace me — it extends me. It sees what I see, says what I'd say.
          </p>
          <p className="text-xl text-white font-semibold mb-8">
            If you're ready for the truth, let's go."
          </p>

          <p className="text-slate-400 mb-8">— Rick Strickland</p>

          <Button
            asChild
            size="lg"
            className="bg-red-600 hover:bg-red-700 text-white font-bold h-14 px-10 text-lg"
          >
            <Link to="/analyze">
              Get Your Free Diagnostic
              <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
