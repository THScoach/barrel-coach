import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight, Users, AlertTriangle, Crown, Zap, BarChart3, Brain, Target, Video, Phone, ClipboardList, Shield } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
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
    answer: "You record your swing on your phone — that's it. Reboot Motion processes the video using markerless motion capture and syncs the biomechanics data to Catching Barrels automatically. No sensors, no wearables, no lab visit required.",
  },
  {
    question: "What's the difference between the Barrels App and Pro Academy?",
    answer: "The Barrels App ($47/mo) is the self-guided system — you get your 4-Pillar Scores, Energy Archetype, and AI-generated drill prescriptions on every upload. The Pro Academy ($149/mo) adds live coaching: weekly Film Room sessions with Coach Strickland, monthly Reboot Motion deep dives, and priority report turnaround.",
  },
  {
    question: "How is the Big League Blueprint different?",
    answer: "The Blueprint ($750/mo) is direct 1:1 access to Coach Strickland. Bi-weekly Zoom sessions, priority text access, custom advance scouting, unlimited Reboot Motion reports, and quarterly recruitment strategy calls. It's capped at 15 players and requires an application.",
  },
  {
    question: "Is the Swing Flaw Audit really free?",
    answer: "Yes. Upload one swing video, get your single biggest energy leak identified in plain language, plus one drill to fix it. No credit card required. To see your full 4-Pillar Score, Energy Archetype, and complete drill program, subscribe to the Barrels App.",
  },
  {
    question: "How much does a private lesson with a professional coach cost?",
    answer: "A single private hitting lesson with a college-level coach runs $100–$150. A professional-level coach charges $150–$250 per session. The Pro Academy delivers weekly group access plus a monthly deep-dive report for $149/mo — less than the cost of one private session.",
  },
  {
    question: "Can I cancel anytime?",
    answer: "The Barrels App and Pro Academy are month-to-month — cancel anytime. The Big League Blueprint requires a 3-month minimum commitment because real swing development takes time.",
  },
  {
    question: "Do you work with coaches and organizations?",
    answer: "Yes. The Coaches & Organizations License starts at $499/mo for up to 10 players. You get a unified Coach Dashboard, bulk video processing, and monthly strategy calls with Coach Strickland. Contact us for custom enterprise pricing.",
  },
  {
    question: "Is this for youth / college / pro?",
    answer: "All of the above. The 4-Pillar System works at every level. Coach Strickland has used it with 10-year-olds and MLB players. The principles don't change — the details do.",
  },
];

export default function Pricing() {
  const navigate = useNavigate();

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

      {/* Hero Headline */}
      <section className="pt-28 sm:pt-32 pb-8 sm:pb-12">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-4 leading-tight">
            Your swing is leaking power.
            <span className="block text-red-400">We can show you exactly where.</span>
          </h1>
          <p className="text-slate-400 text-base sm:text-lg max-w-2xl mx-auto">
            Just video. No sensors. The same biomechanics system used by AAA hitters — built by the coach who turned Cedric Mullins from a .098 ISO into a career year.
          </p>
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
                Upload one swing video. Get your single biggest energy leak identified in plain language, plus one drill to fix it. No sensors. No credit card.
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
              <p className="text-slate-400 text-sm mb-4">The System. No Guesswork.</p>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-4xl sm:text-5xl font-black text-white">$47</span>
                <span className="text-lg text-slate-400">/month</span>
              </div>
              <p className="text-xs text-slate-500 mb-6">or $397/year (save $167)</p>

              <ul className="space-y-3 mb-8 flex-grow">
                <li className="flex items-start gap-3 text-slate-200 text-sm">
                  <Check className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" />
                  <span>Just video. No sensors. Record on your phone.</span>
                </li>
                <li className="flex items-start gap-3 text-slate-200 text-sm">
                  <Check className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" />
                  <span>4-Pillar Swing Scoring (Body, Brain, Bat, Ball)</span>
                </li>
                <li className="flex items-start gap-3 text-slate-200 text-sm">
                  <Check className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" />
                  <span>Energy Archetype Classification with roadmap</span>
                </li>
                <li className="flex items-start gap-3 text-slate-200 text-sm">
                  <Check className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" />
                  <span>Pelvis Dysfunction Detection</span>
                </li>
                <li className="flex items-start gap-3 text-slate-200 text-sm">
                  <Check className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" />
                  <span>PCE Model — predicted bat speed & exit velo</span>
                </li>
                <li className="flex items-start gap-3 text-slate-200 text-sm">
                  <Check className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" />
                  <span>AI Drill Prescriptions based on your motor profile</span>
                </li>
                <li className="flex items-start gap-3 text-slate-200 text-sm">
                  <Check className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" />
                  <span>24/7 Coach Barrels AI assistant</span>
                </li>
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
              <p className="text-slate-400 text-sm mb-4">The combination that actually develops hitters.</p>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-4xl sm:text-5xl font-black text-white">$149</span>
                <span className="text-lg text-slate-400">/month</span>
              </div>
              <p className="text-xs text-slate-500 mb-6">or $1,297/year (save $491)</p>

              <ul className="space-y-3 mb-8 flex-grow">
                <li className="flex items-start gap-3 text-slate-200 text-sm font-medium">
                  <Zap className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <span>Everything in the Barrels App</span>
                </li>
                <li className="flex items-start gap-3 text-slate-200 text-sm">
                  <Check className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <span>Weekly Live Film Room with Coach Strickland</span>
                </li>
                <li className="flex items-start gap-3 text-slate-200 text-sm">
                  <Check className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <span>Monthly Reboot Motion Biomechanics Deep Dive</span>
                </li>
                <li className="flex items-start gap-3 text-slate-200 text-sm">
                  <Check className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <span>48-Hour Priority Report Turnaround</span>
                </li>
                <li className="flex items-start gap-3 text-slate-200 text-sm">
                  <Check className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <span>Advanced Session Tracking with trend lines</span>
                </li>
                <li className="flex items-start gap-3 text-slate-200 text-sm">
                  <Check className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <span>The Barrels Playbook — monthly Coach Rick breakdown</span>
                </li>
              </ul>

              <Button 
                onClick={() => handleCheckout('pro_academy')}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-5 text-base"
              >
                Join The Pro Academy
              </Button>
              <p className="text-xs text-slate-400 text-center mt-3">
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
              <p className="text-slate-400 text-sm mb-4">For the player serious about the next level.</p>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-4xl sm:text-5xl font-black text-white">$750</span>
                <span className="text-lg text-slate-400">/month</span>
              </div>
              <p className="text-xs text-slate-500 mb-6">3-month minimum · or $1,997 for 3-mo block</p>

              <ul className="space-y-3 mb-6 flex-grow">
                <li className="flex items-start gap-3 text-slate-200 text-sm font-medium">
                  <Zap className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <span>Everything in the Pro Academy</span>
                </li>
                <li className="flex items-start gap-3 text-slate-200 text-sm">
                  <Check className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <span>Bi-weekly 1:1 Zoom with Coach Strickland (45 min)</span>
                </li>
                <li className="flex items-start gap-3 text-slate-200 text-sm">
                  <Check className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <span>Priority WhatsApp/Text — 24hr response (Mon–Fri)</span>
                </li>
                <li className="flex items-start gap-3 text-slate-200 text-sm">
                  <Check className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <span>Custom Advance Scouting & Pitcher Attack Plans</span>
                </li>
                <li className="flex items-start gap-3 text-slate-200 text-sm">
                  <Check className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <span>Unlimited Reboot Motion reports — all reviewed personally</span>
                </li>
                <li className="flex items-start gap-3 text-slate-200 text-sm">
                  <Check className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <span>Quarterly Recruitment Strategy Session</span>
                </li>
              </ul>

              {/* Scarcity */}
              <div className="flex items-center justify-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg mb-5">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span className="text-amber-400 text-xs font-semibold">Capped at 15 players</span>
              </div>

              <Button asChild className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-5 text-base">
                <a href="mailto:rick@catchingbarrels.io?subject=Big League Blueprint Application">Apply for the Blueprint →</a>
              </Button>
              <p className="text-xs text-slate-500 text-center mt-3">
                Applications reviewed personally by Coach Strickland.
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
                <p className="text-slate-400 text-sm mb-4">
                  Bring pro-level biomechanics to your entire roster. Unified Coach Dashboard, bulk video processing, and monthly strategy calls with Coach Strickland.
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

      {/* Value Anchor */}
      <section className="pb-12 sm:pb-16">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-gradient-to-r from-red-500/10 to-amber-500/5 border border-red-500/30 rounded-2xl p-6 sm:p-8 text-center">
            <h3 className="text-xl sm:text-2xl font-bold text-white mb-3">The Math Is Simple</h3>
            <div className="grid sm:grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-black text-red-400">$150–$250</div>
                <div className="text-xs text-slate-400 mt-1">One private session with a professional coach</div>
              </div>
              <div>
                <div className="text-2xl font-black text-white">$149/mo</div>
                <div className="text-xs text-slate-400 mt-1">Weekly Film Room + monthly deep dive + full platform</div>
              </div>
              <div>
                <div className="text-2xl font-black text-teal-400">$47/mo</div>
                <div className="text-xs text-slate-400 mt-1">Pro-level swing analysis on every upload</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Ascension Path */}
      <section className="pb-12 sm:pb-16">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h3 className="text-lg font-bold text-white mb-6">Your Path Forward</h3>
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
            Upload one swing video. See your biggest energy leak in 60 seconds. Free.
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
