import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight, Gift, BarChart3, Video, Users, Unlock, Target, TrendingUp, Phone, MessageCircle, ClipboardList, Zap, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "Is the diagnostic really free?",
    answer: "Yes. 100% free. No credit card. Upload your swing, get a snapshot of what's happening. Delivered via SMS. No drills. No guessing.",
  },
  {
    question: "What's included with the Smart Sensor Kit?",
    answer: "You get a Diamond Kinetics sensor (retail $150) shipped to you for free when you join The Academy. It tracks every swing automatically and syncs with your Kinetic DNA dashboard.",
  },
  {
    question: "What is Monday Night Film Room?",
    answer: "Every Monday, Coach Rick reviews member swings live. You watch, learn, and get direct feedback. It's group coaching that actually works.",
  },
  {
    question: "How is Inner Circle different from The Academy?",
    answer: "Inner Circle includes everything in The Academy plus 2x monthly private video lessons with Coach Rick, direct chat access, custom training plans, and priority analysis. Limited to 20 players.",
  },
  {
    question: "Can I upgrade from Academy to Inner Circle later?",
    answer: "Yes, if spots are available. Inner Circle is capped at 20 players to ensure quality 1-on-1 time with Coach Rick.",
  },
  {
    question: "What if I'm in-season?",
    answer: "Good. In-season is when patterns break down under pressure. I'll show you what to focus on without overloading your brain before games.",
  },
  {
    question: "Can parents join?",
    answer: "Absolutely. I encourage it. Parents learn what to look for, and players get accountability at home.",
  },
  {
    question: "Is this for youth / college / pro?",
    answer: "All of the above. The 4B System works at every level. I've used it with 10-year-olds and MLB players. The principles don't change — the details do.",
  },
];

export default function Pricing() {
  return (
    <div className="min-h-screen bg-slate-950">
      <Header />

      {/* Hero */}
      <section className="pt-32 pb-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-6xl font-black text-white mb-6">
            CHOOSE YOUR PATH
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Start with the free diagnostic. Level up when you're ready.
          </p>
        </div>
      </section>

      {/* Pricing Cards — Main 3 */}
      <section className="pb-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-6 items-start">
            
            {/* 1. Free Diagnostic — $0 */}
            <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-6 flex flex-col">
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-white mb-2">Free Diagnostic</h3>
                <div className="text-5xl font-black text-white mb-2">$0</div>
                <p className="text-slate-500 text-sm">One-time · No credit card</p>
              </div>
              
              <ul className="space-y-3 mb-6 flex-grow">
                <li className="flex items-start gap-3 text-slate-300">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span>Single swing analysis</span>
                </li>
                <li className="flex items-start gap-3 text-slate-300">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span>Baseline scores</span>
                </li>
                <li className="flex items-start gap-3 text-slate-300">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span>Motor Profile identification</span>
                </li>
              </ul>

              <Button asChild className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-6 text-lg">
                <Link to="/diagnostic">Get Free Diagnostic</Link>
              </Button>
            </div>

            {/* 2. THE ACADEMY — $99/month (FEATURED / MOST PROMINENT) */}
            <div className="bg-slate-900 border-2 border-red-500 rounded-2xl p-8 flex flex-col relative ring-4 ring-red-500/30 scale-105 shadow-2xl shadow-red-500/20 md:-mt-4 md:mb-4">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-6 py-2 bg-red-600 rounded-full text-sm font-bold text-white uppercase tracking-wider">
                Most Popular
              </div>
              
              <div className="mb-6 pt-2">
                <h3 className="text-2xl font-bold text-white mb-2">The Academy</h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-black text-white">$99</span>
                  <span className="text-xl text-slate-400">/mo</span>
                </div>
              </div>

              <ul className="space-y-4 mb-8 flex-grow">
                {/* FREE SENSOR KIT - HIGHLIGHTED */}
                <li className="flex items-start gap-3 p-3 bg-gradient-to-r from-yellow-500/20 to-orange-500/10 border border-yellow-500/40 rounded-xl">
                  <Gift className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-white font-bold">FREE Smart Sensor Kit</span>
                    <span className="block text-yellow-400 text-sm font-medium">Retail $150 – We ship it today</span>
                  </div>
                </li>
                
                <li className="flex items-start gap-3 text-slate-200">
                  <BarChart3 className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <span>📊 Daily Kinetic DNA Tracking</span>
                </li>
                <li className="flex items-start gap-3 text-slate-200">
                  <Video className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <span>🎥 Auto-Video Analysis (Sensor triggers camera)</span>
                </li>
                <li className="flex items-start gap-3 text-slate-200">
                  <Users className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <span>⚾ Monday Night Film Room (Live Group Coaching with Coach Rick)</span>
                </li>
                <li className="flex items-start gap-3 text-slate-200">
                  <Unlock className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <span>🔓 Full Drill Library Access</span>
                </li>
                <li className="flex items-start gap-3 text-slate-200">
                  <Target className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <span>👥 Community & Challenges</span>
                </li>
                <li className="flex items-start gap-3 text-slate-200">
                  <TrendingUp className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <span>📈 Kinetic Fingerprint & Progress Tracking</span>
                </li>
              </ul>

              <Button asChild className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-6 text-lg">
                <Link to="/coaching">Join The Academy</Link>
              </Button>
            </div>

            {/* 3. INNER CIRCLE — $199/month */}
            <div className="bg-slate-900/80 border border-slate-600 rounded-2xl p-6 flex flex-col">
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-white mb-2">Inner Circle</h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-black text-white">$199</span>
                  <span className="text-xl text-slate-400">/mo</span>
                </div>
              </div>

              <ul className="space-y-4 mb-6 flex-grow">
                {/* Everything in Academy */}
                <li className="flex items-start gap-3 text-slate-200">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <span className="font-semibold">✅ Everything in The Academy</span>
                </li>
                
                <li className="flex items-start gap-3 text-slate-200">
                  <Phone className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <span>📞 2x Monthly Private Video Lessons (15-20 min Zoom with Coach Rick)</span>
                </li>
                <li className="flex items-start gap-3 text-slate-200">
                  <MessageCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <span>💬 Direct Chat Access (Skip the line – priority support)</span>
                </li>
                <li className="flex items-start gap-3 text-slate-200">
                  <ClipboardList className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <span>📋 Custom Training Plan (Personalized drill adjustments)</span>
                </li>
                <li className="flex items-start gap-3 text-slate-200">
                  <Zap className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <span>⚡ Priority Analysis (Your swings reviewed first)</span>
                </li>
              </ul>

              {/* Limited Spots Warning */}
              <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg mb-6">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                <span className="text-amber-400 text-sm font-medium">⚠️ Limited to 20 players</span>
              </div>

              <Button asChild variant="outline" className="w-full border-slate-500 hover:bg-slate-800 text-white font-bold py-6 text-lg">
                <Link to="/inner-circle">Apply for Inner Circle</Link>
              </Button>
            </div>

          </div>
        </div>
      </section>

      {/* Value Comparison */}
      <section className="pb-16">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/5 border border-yellow-500/30 rounded-2xl p-8 text-center">
            <Gift className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-white mb-2">The Academy Value</h3>
            <p className="text-slate-300 mb-4">
              Your first month includes the <span className="text-yellow-400 font-bold">FREE Smart Sensor Kit</span> (retail $150).
            </p>
            <p className="text-slate-400 text-sm">
              That's $150 of hardware + full coaching access for just $99. No contracts. Cancel anytime.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-white mb-8 text-center">
            Questions?
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
      <section className="py-16 bg-slate-900/50">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Not sure? Start free.
          </h2>
          <p className="text-slate-400 mb-8">
            Upload one swing. See your scores. Then decide.
          </p>
          <Button asChild size="lg" className="bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-6 text-lg">
            <Link to="/diagnostic" className="flex items-center gap-2">
              Get Free Diagnostic
              <ArrowRight className="w-5 h-5" />
            </Link>
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
