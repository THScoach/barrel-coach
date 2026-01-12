import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight, MessageCircle, Users, Zap, Crown } from "lucide-react";
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
    answer: "Yes. 100% free. No credit card. Upload your swing, get a snapshot of what's happening. It's one response — clarity, not coaching.",
  },
  {
    question: "What is Catching Barrels Live?",
    answer: "It's a weekly live group call on Monday nights where I cover concepts, answer questions, and keep players sharp. It's not a transformation program — it's a retention and accountability layer.",
  },
  {
    question: "How is the 90-Day Small Group different from 1-on-1?",
    answer: "The Small Group (max 3 players) gives you structured development with group coaching. 1-on-1 gives you my full attention and personalized feedback — fastest results, highest access.",
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
            PICK YOUR PATH
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Four ways to work with me. Start free. Go deeper when you're ready.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* 1. Free Diagnostic — $0 */}
            <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-8 flex flex-col">
              <div className="mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-800 rounded-full mb-4">
                  <MessageCircle className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Entry Point</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Free Diagnostic</h3>
                <div className="text-4xl font-black text-white mb-2">$0</div>
                <p className="text-slate-500 text-sm">One-time snapshot</p>
              </div>
              
              <p className="text-slate-400 text-sm mb-6">
                Identify your #1 swing leak. Get clarity, not a full plan.
              </p>

              <ul className="space-y-3 mb-8 flex-grow">
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                  One response from Rick's system
                </li>
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                  Primary leak identified
                </li>
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                  No credit card required
                </li>
              </ul>

              <Button asChild className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold">
                <Link to="/analyze">Get Free Diagnostic</Link>
              </Button>
            </div>

            {/* 2. Catching Barrels Live — $99/month */}
            <div className="bg-slate-900/80 border border-blue-500/30 rounded-2xl p-8 flex flex-col">
              <div className="mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 rounded-full mb-4">
                  <Users className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Community</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Catching Barrels Live</h3>
                <div className="text-4xl font-black text-white mb-2">$99</div>
                <p className="text-slate-500 text-sm">per month</p>
              </div>
              
              <p className="text-slate-400 text-sm mb-6">
                Stay sharp, accountable, and learning. Ongoing community access.
              </p>

              <ul className="space-y-3 mb-8 flex-grow">
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <Check className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  Weekly live group call (Monday nights)
                </li>
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <Check className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  Group Q&A with Rick
                </li>
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <Check className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  Ongoing education
                </li>
              </ul>

              <Button asChild className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold">
                <Link to="/apply?tier=live">Join Live</Link>
              </Button>
              <p className="text-xs text-slate-500 mt-3 text-center">Not a transformation program</p>
            </div>

            {/* 3. 90-Day Small Group — $1,299 */}
            <div className="bg-slate-900/80 border-2 border-red-500/50 rounded-2xl p-8 flex flex-col relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-red-600 rounded-full text-xs font-bold text-white uppercase tracking-wider">
                Core Program
              </div>
              
              <div className="mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/20 rounded-full mb-4">
                  <Zap className="w-4 h-4 text-red-400" />
                  <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Development</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">90-Day Small Group</h3>
                <div className="text-4xl font-black text-white mb-2">$1,299</div>
                <p className="text-slate-500 text-sm">90-day program</p>
              </div>
              
              <p className="text-slate-400 text-sm mb-6">
                Real change. Structured development. Maximum 3 players per group.
              </p>

              <ul className="space-y-3 mb-8 flex-grow">
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <Check className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  90-day structured curriculum
                </li>
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <Check className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  Max 3 players per group
                </li>
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <Check className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  Group coaching environment
                </li>
              </ul>

              <Button asChild className="w-full bg-red-600 hover:bg-red-700 text-white font-bold">
                <Link to="/apply?tier=group">Apply Now</Link>
              </Button>
              <p className="text-xs text-slate-500 mt-3 text-center">Limited seats. Outcome-focused.</p>
            </div>

            {/* 4. 1-on-1 Coaching — $2,997 */}
            <div className="bg-gradient-to-b from-slate-900 to-slate-900/80 border border-yellow-500/30 rounded-2xl p-8 flex flex-col">
              <div className="mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-500/20 rounded-full mb-4">
                  <Crown className="w-4 h-4 text-yellow-400" />
                  <span className="text-xs font-bold text-yellow-400 uppercase tracking-wider">Flagship</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">1-on-1 Coaching</h3>
                <div className="text-4xl font-black text-white mb-2">$2,997</div>
                <p className="text-slate-500 text-sm">90-day program</p>
              </div>
              
              <p className="text-slate-400 text-sm mb-6">
                Direct access to Rick. Personalized feedback. Fastest results.
              </p>

              <ul className="space-y-3 mb-8 flex-grow">
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <Check className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                  90-day personalized program
                </li>
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <Check className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                  Direct access to Rick
                </li>
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <Check className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                  Personalized feedback + iteration
                </li>
              </ul>

              <Button asChild className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold">
                <Link to="/apply?tier=1on1">Apply Now</Link>
              </Button>
              <p className="text-xs text-slate-500 mt-3 text-center">Limited availability by design.</p>
            </div>

          </div>
        </div>
      </section>

      {/* Ascension Logic */}
      <section className="py-16 bg-slate-900/50 border-y border-slate-800">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl font-black text-white text-center mb-8">
            THE PATH
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="p-4">
              <div className="text-slate-400 text-sm mb-2">"What's wrong?"</div>
              <div className="text-white font-bold">Free Diagnostic</div>
            </div>
            <div className="p-4">
              <div className="text-slate-400 text-sm mb-2">"Stay sharp"</div>
              <div className="text-white font-bold">$99 Live</div>
            </div>
            <div className="p-4">
              <div className="text-slate-400 text-sm mb-2">"I want change"</div>
              <div className="text-white font-bold">$1,299 Group</div>
            </div>
            <div className="p-4">
              <div className="text-slate-400 text-sm mb-2">"I want Rick"</div>
              <div className="text-white font-bold">$2,997 1-on-1</div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-3xl font-black text-white text-center mb-12">
            QUESTIONS?
          </h2>
          
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="bg-slate-900/80 border border-slate-800 rounded-xl px-6"
              >
                <AccordionTrigger className="text-left font-semibold text-white hover:no-underline py-5">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-slate-400 pb-5">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20">
        <div className="max-w-xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-black text-white mb-4">
            READY TO START?
          </h2>
          <p className="text-slate-400 mb-8">
            Get your free diagnostic. No credit card. No commitment.
          </p>
          <Button
            asChild
            size="lg"
            className="bg-red-600 hover:bg-red-700 text-white font-bold h-14 px-10 text-lg"
          >
            <Link to="/analyze">
              Get Free Diagnostic
              <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
}