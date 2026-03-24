import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight, Users, AlertTriangle, Zap, Target, Shield, TrendingUp, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const faqs = [
  {
    question: "What does 'Just video. No sensors.' mean?",
    answer: "You record your swing on your phone — that's it. Our system processes the video using markerless motion capture and syncs the biomechanics data automatically. No sensors, no wearables, no lab visit required. This is the lowest-friction biomechanics pipeline in the sport.",
  },
  {
    question: "What's the difference between the Barrels App and Pro Academy?",
    answer: "The Barrels App ($47/mo) is the self-guided system — you get your 4-Pillar Scores, Energy Archetype, and AI-generated drill prescriptions on every upload. Zero coach time required. The Pro Academy ($149/mo) adds live coaching: weekly Film Room sessions with Coach Strickland, monthly biomechanics deep dives, and 48-hour priority report turnaround. One private lesson costs $150–$200. This is weekly access for the same price.",
  },
  {
    question: "How is the Big League Blueprint different?",
    answer: "The Blueprint is direct, personalized access to Coach Strickland — bi-weekly 1:1 Zoom sessions, priority WhatsApp/text access with 24-hour voice memo responses, custom advance scouting, unlimited biomechanics reports all reviewed personally, and quarterly recruitment strategy calls. It's capped at 15 players and requires an application because real development requires real attention.",
  },
  {
    question: "Is the Swing Flaw Audit really free?",
    answer: "Yes. Upload one swing video, get your single biggest energy leak identified in plain language, plus one drill to fix it. No credit card required. To see your full 4-Pillar Score, Energy Archetype, PCE prediction, and complete drill program, subscribe to the Barrels App.",
  },
  {
    question: "How does the pricing compare to private lessons?",
    answer: "A single private hitting lesson with a college-level coach runs $100–$150. A professional-level coach charges $150–$250 per session. The Pro Academy delivers weekly group access plus a monthly deep-dive biomechanics report for $149/mo — less than the cost of one session. The Big League Blueprint at $750/mo is still less than four private sessions, and delivers continuous access, data analysis, and advance scouting on top.",
  },
  {
    question: "Can I cancel anytime?",
    answer: "The Barrels App and Pro Academy are month-to-month — cancel anytime, your data stays yours. The Big League Blueprint requires a 3-month minimum commitment because real swing development takes time and Coach Strickland invests heavily in each player's plan.",
  },
  {
    question: "Do you work with coaches and organizations?",
    answer: "Yes. The Coaches & Organizations License starts at $499/mo for up to 10 players. You get a unified Coach Dashboard with all players' 4-Pillar Scores and Energy Archetypes, bulk video processing, coach certification access, and monthly strategy calls with Coach Strickland. College programs and MLB organizations can contact us for custom enterprise pricing.",
  },
  {
    question: "Is this for youth / college / pro?",
    answer: "All of the above. The 4-Pillar System works at every level. Coach Strickland has used it with 10-year-olds and MLB hitters. The principles don't change — the details do. The technology reads your swing the same way regardless of your level.",
  },
  {
    question: "What if I apply for the Blueprint and don't get accepted?",
    answer: "Coach Strickland personally reviews every application. If you're not quite ready for the Blueprint, you'll be offered a Pro Academy membership as the right next step — with specific guidance on what to work on over the next 90 days before reapplying. It's not a rejection; it's a development milestone.",
  },
];

export default function Pricing() {
  const handleCheckout = async (priceType: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('create-subscription-checkout', {
        body: { priceType }
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error('Unable to start checkout. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <Header />

      {/* Hero Headline — HMOLC Voice */}
      <section className="pt-28 sm:pt-32 pb-8 sm:pb-12">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-4 leading-tight">
            Your swing is leaking power.
            <span className="block text-red-400">We can show you exactly where.</span>
          </h1>
          <p className="text-slate-400 text-base sm:text-lg max-w-2xl mx-auto mb-6">
            Just video. No sensors. The same biomechanics system used by AAA hitters — built by the coach who turned Cedric Mullins from a .098 ISO into a career year. Now available for your swing.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> Cancel anytime</span>
            <span className="text-slate-700">·</span>
            <span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Your data stays yours</span>
            <span className="text-slate-700">·</span>
            <span className="flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> 400+ college commits</span>
          </div>
        </div>
      </section>

      {/* Free Audit Banner */}
      <section className="pb-8 sm:pb-12">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-gradient-to-r from-teal-500/10 to-emerald-500/5 border border-teal-500/30 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
            <div className="w-14 h-14 rounded-full bg-teal-500/20 border border-teal-500/40 flex items-center justify-center flex-shrink-0">
              <Target className="w-7 h-7 text-teal-400" />
            </div>
            <div className="flex-grow text-center sm:text-left">
              <h3 className="text-xl font-bold text-white mb-1">The Swing Flaw Audit — Free</h3>
              <p className="text-slate-400 text-sm">
                Upload one swing video. Get your single biggest energy leak identified in plain language, plus one drill to fix it. To see your full 4-Pillar Score, Energy Archetype, and complete drill program — subscribe below.
              </p>
            </div>
            <Button asChild className="bg-teal-600 hover:bg-teal-700 text-white font-bold px-6 flex-shrink-0">
              <Link to="/diagnostic">Get Your Free Audit →</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Pricing Cards — 3 Core Tiers */}
      <section className="pb-12 sm:pb-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-5 sm:gap-6 items-start">
            
            {/* Tier 1: The Barrels App */}
            <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-6 sm:p-8 flex flex-col">
              <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">
                Self-Guided
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-white mb-1">The Barrels App</h3>
              <p className="text-slate-400 text-sm mb-4 font-medium">The System. No Guesswork.</p>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-4xl sm:text-5xl font-black text-white">$47</span>
                <span className="text-lg text-slate-400">/month</span>
              </div>
              <p className="text-xs text-slate-500 mb-6">or $397/year (save $167)</p>

              <p className="text-slate-300 text-sm mb-5 leading-relaxed">
                Most players practice hard and get nowhere — not because they lack effort, but because they lack a system. Record your swing on your phone. Our system processes it into biomechanics data automatically and scores it across four pillars.
              </p>

              <ul className="space-y-3 mb-8 flex-grow">
                {[
                  "Just video. No sensors. Record on your phone.",
                  "4-Pillar Swing Scoring (Body, Brain, Bat, Ball) — 0 to 100",
                  "Energy Archetype Classification with development roadmap",
                  "Pelvis Dysfunction Detection — the root cause most coaches miss",
                  "PCE Model — predicted bat speed & exit velo benchmarks",
                  "AI Drill Prescriptions based on your motor profile",
                  "Session-over-Session Progress Tracking",
                  "24/7 Coach Barrels AI — ask anything, get pro-level answers",
                ].map((f, i) => (
                  <li key={i} className="flex items-start gap-3 text-slate-200 text-sm">
                    <Check className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <Button 
                onClick={() => handleCheckout('barrels_app')}
                className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-5 text-base"
              >
                Start Training
              </Button>
              <p className="text-xs text-slate-500 text-center mt-3">Cancel anytime. Your data stays yours.</p>
            </div>

            {/* Tier 2: The Pro Academy — MOST POPULAR */}
            <div className="bg-slate-900 border-2 border-red-500/60 rounded-2xl p-6 sm:p-8 flex flex-col relative ring-4 ring-red-500/20 md:-translate-y-3 shadow-2xl shadow-red-500/10">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-5 py-1.5 bg-red-600 rounded-full text-xs font-bold text-white uppercase tracking-wider whitespace-nowrap">
                Most Popular
              </div>
              
              <div className="text-red-400 text-xs font-bold uppercase tracking-wider mb-3 pt-2">
                Data + Coaching
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-white mb-1">The Pro Academy</h3>
              <p className="text-slate-400 text-sm mb-4 font-medium">The combination that actually develops hitters.</p>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-4xl sm:text-5xl font-black text-white">$149</span>
                <span className="text-lg text-slate-400">/month</span>
              </div>
              <p className="text-xs text-slate-500 mb-6">or $1,297/year (save $491)</p>

              <p className="text-slate-300 text-sm mb-5 leading-relaxed">
                The Barrels App tells you what's wrong. The Pro Academy tells you how to fix it — with a real coach in the room. Every week, your swing goes up on the screen. You get real-time feedback from a coach who has developed players at every level.
              </p>

              <ul className="space-y-3 mb-8 flex-grow">
                {[
                  "Everything in the Barrels App",
                  "Weekly Live Film Room with Coach Strickland",
                  "Monthly Biomechanics Deep Dive — full Energy Delivery Report with Compensation Detection",
                  "48-Hour Priority Report Turnaround",
                  "Advanced Session Tracking with trend lines & archetype evolution",
                  "The Barrels Playbook — monthly written breakdown from Coach Strickland's AAA coaching work",
                ].map((f, i) => (
                  <li key={i} className={`flex items-start gap-3 text-slate-200 text-sm ${i === 0 ? 'font-medium' : ''}`}>
                    {i === 0 ? (
                      <Zap className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <Check className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    )}
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <Button 
                onClick={() => handleCheckout('pro_academy')}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-5 text-base"
              >
                Join The Pro Academy
              </Button>
              <p className="text-xs text-slate-400 text-center mt-3 font-medium">
                One private lesson costs $150–$200. This is weekly access for the same price.
              </p>
            </div>

            {/* Tier 3: The Big League Blueprint */}
            <div className="bg-gradient-to-b from-slate-900 to-amber-950/20 border-2 border-amber-500/40 rounded-2xl p-6 sm:p-8 flex flex-col relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-amber-600 rounded-full text-xs font-bold text-white uppercase tracking-wider whitespace-nowrap">
                Application Only
              </div>
              
              <div className="text-amber-400 text-xs font-bold uppercase tracking-wider mb-3 pt-2">
                1:1 with Coach Rick
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-white mb-1">Big League Blueprint</h3>
              <p className="text-slate-400 text-sm mb-4 font-medium">For the player serious about the next level.</p>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-4xl sm:text-5xl font-black text-white">$750</span>
                <span className="text-lg text-slate-400">/month</span>
              </div>
              <p className="text-xs text-slate-500 mb-6">3-month minimum · or $1,997 for 3-mo block</p>

              <p className="text-slate-300 text-sm mb-5 leading-relaxed">
                This is not for everyone. It is for the player who has done the work, knows they have real ability, and needs a professional coach in their corner — not a generic program, not a course. A real coach who knows their swing.
              </p>

              <ul className="space-y-3 mb-6 flex-grow">
                {[
                  "Everything in the Pro Academy",
                  "Bi-weekly 1:1 Zoom with Coach Strickland (45 min each)",
                  "Priority WhatsApp/Text — voice memo response within 24hrs (Mon–Fri)",
                  "Custom Advance Scouting & Pitcher Attack Plans",
                  "Unlimited Video Submissions — all reviewed by Coach Strickland personally",
                  "Quarterly Recruitment Strategy Session — college positioning, showcase strategy",
                ].map((f, i) => (
                  <li key={i} className={`flex items-start gap-3 text-slate-200 text-sm ${i === 0 ? 'font-medium' : ''}`}>
                    {i === 0 ? (
                      <Zap className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <Check className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    )}
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="flex items-center justify-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg mb-5">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span className="text-amber-400 text-xs font-semibold">Capped at 15 players. When it's full, it's full.</span>
              </div>

              <Button asChild className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-5 text-base">
                <a href="mailto:rick@catchingbarrels.io?subject=Big League Blueprint Application">Apply for the Blueprint →</a>
              </Button>
              <p className="text-xs text-slate-500 text-center mt-3">
                Applications reviewed personally by Coach Strickland. Not everyone is accepted.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* Coaches & Organizations */}
      <section className="pb-12 sm:pb-16">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row items-start gap-5">
              <div className="w-14 h-14 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center flex-shrink-0">
                <Users className="w-7 h-7 text-slate-300" />
              </div>
              <div className="flex-grow">
                <h3 className="text-xl font-bold text-white mb-1">Coaches & Organizations License</h3>
                <p className="text-slate-300 text-sm mb-2 font-medium">Bring Pro-Level Biomechanics to Your Entire Roster.</p>
                <p className="text-slate-400 text-sm mb-4">
                  Every player gets a 4-Pillar Score, an Energy Archetype, and a drill prescription. You get a unified dashboard showing every player's development trajectory. Plus monthly strategy calls with Coach Strickland.
                </p>
                <div className="grid sm:grid-cols-3 gap-3 mb-5">
                  <div className="bg-slate-800/60 rounded-lg p-3 text-center">
                    <div className="text-lg font-black text-white">$499</div>
                    <div className="text-xs text-slate-400">up to 10 players</div>
                  </div>
                  <div className="bg-slate-800/60 rounded-lg p-3 text-center">
                    <div className="text-lg font-black text-white">$997</div>
                    <div className="text-xs text-slate-400">up to 25 players</div>
                  </div>
                  <div className="bg-slate-800/60 rounded-lg p-3 text-center">
                    <div className="text-lg font-black text-white">Custom</div>
                    <div className="text-xs text-slate-400">college & MLB enterprise</div>
                  </div>
                </div>
                <Button asChild variant="outline" className="border-slate-600 hover:bg-slate-800 text-white font-bold">
                  <a href="mailto:rick@catchingbarrels.io?subject=Coaches License Inquiry">Request a Demo →</a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Competitive Value Anchor */}
      <section className="pb-12 sm:pb-16">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-gradient-to-r from-red-500/10 to-amber-500/5 border border-red-500/30 rounded-2xl p-6 sm:p-8">
            <h3 className="text-xl sm:text-2xl font-bold text-white mb-6 text-center">The Math Is Simple</h3>
            
            {/* Comparison Table */}
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left text-slate-400 font-medium py-2 pr-4">Service</th>
                    <th className="text-left text-slate-400 font-medium py-2 pr-4">Price</th>
                    <th className="text-left text-slate-400 font-medium py-2">What You Get</th>
                  </tr>
                </thead>
                <tbody className="text-slate-300">
                  <tr className="border-b border-slate-800/50">
                    <td className="py-2.5 pr-4 text-slate-400">Private lesson (college coach)</td>
                    <td className="py-2.5 pr-4 whitespace-nowrap">$100–$150/session</td>
                    <td className="py-2.5 text-slate-500">One session, no data, no tracking</td>
                  </tr>
                  <tr className="border-b border-slate-800/50">
                    <td className="py-2.5 pr-4 text-slate-400">Private lesson (professional coach)</td>
                    <td className="py-2.5 pr-4 whitespace-nowrap">$150–$250/session</td>
                    <td className="py-2.5 text-slate-500">One session, no data, no tracking</td>
                  </tr>
                  <tr className="border-b border-slate-800/50">
                    <td className="py-2.5 pr-4 text-slate-400">Biomechanics report (Golf — Sportsbox AI)</td>
                    <td className="py-2.5 pr-4 whitespace-nowrap">$150 one-time</td>
                    <td className="py-2.5 text-slate-500">Single report + 15-min debrief</td>
                  </tr>
                  <tr className="bg-red-500/5 rounded">
                    <td className="py-2.5 pr-4 text-white font-semibold">Catching Barrels Pro Academy</td>
                    <td className="py-2.5 pr-4 text-red-400 font-bold whitespace-nowrap">$149/mo</td>
                    <td className="py-2.5 text-white text-xs">Weekly live coaching + monthly biomechanics deep dive + full AI platform + session tracking</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-slate-400 text-xs text-center italic">
              The Pro Academy delivers more value than a single private lesson with a professional coach, yet costs the same or less — every month.
            </p>
          </div>
        </div>
      </section>

      {/* Ascension Path */}
      <section className="pb-12 sm:pb-16">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h3 className="text-lg font-bold text-white mb-2">Your Path Forward</h3>
          <p className="text-slate-500 text-xs mb-6">Each tier creates desire for the next one by delivering real results.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 text-sm">
            <div className="bg-teal-500/10 border border-teal-500/30 rounded-lg px-4 py-2 text-teal-400 font-medium">
              Free Audit
            </div>
            <ArrowRight className="w-4 h-4 text-slate-600 rotate-90 sm:rotate-0" />
            <div className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white font-medium">
              Barrels App · $47
            </div>
            <ArrowRight className="w-4 h-4 text-slate-600 rotate-90 sm:rotate-0" />
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-red-400 font-medium">
              Pro Academy · $149
            </div>
            <ArrowRight className="w-4 h-4 text-slate-600 rotate-90 sm:rotate-0" />
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-2 text-amber-400 font-medium">
              Blueprint · $750
            </div>
          </div>
          <div className="mt-3 text-slate-600 text-xs">
            ↳ Coaches & Organizations · parallel track
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-12 sm:py-16">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-8 text-center">
            Common Questions
          </h2>
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`faq-${index}`} className="border-slate-800">
                <AccordionTrigger className="text-white hover:text-red-400 text-left">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-slate-400">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-12 sm:py-16 bg-slate-900/50">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            Ready to stop guessing?
          </h2>
          <p className="text-slate-400 mb-8">
            Upload one swing video. See your biggest energy leak in 60 seconds. Free. No sensors. No credit card.
          </p>
          <Button asChild size="lg" className="bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-6 text-lg">
            <Link to="/diagnostic" className="flex items-center gap-2">
              Get Your Free Swing Flaw Audit
              <ArrowRight className="w-5 h-5" />
            </Link>
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
