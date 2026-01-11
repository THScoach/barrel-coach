import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight, MessageCircle, Target, Zap } from "lucide-react";
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
    question: "Do you do drills?",
    answer: "In the free diagnostic? No. That's coaching. Drills and training plans come with In-Person Assessments or the 90-Day program.",
  },
  {
    question: "What if I'm in-season?",
    answer: "Good. In-season is when patterns break down under pressure. I'll show you what to focus on without overloading your brain before games.",
  },
  {
    question: "Can parents join the assessment?",
    answer: "Absolutely. I encourage it. Parents learn what to look for, and players get accountability at home.",
  },
  {
    question: "Is this for youth / college / pro?",
    answer: "All of the above. The 4B System works at every level. I've used it with 10-year-olds and MLB players. The principles don't change — the details do.",
  },
  {
    question: "How do I apply for the 90-Day program?",
    answer: "Click 'Apply Now' and fill out the short application. I'll review it personally and reach out if it's a fit. Not everyone is accepted — this is for serious players only.",
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
            Three ways to work with me. Start free. Go deeper when you're ready.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-20">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-6">
            
            {/* Free Diagnostic */}
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
                Upload your swing. Get clarity on what's happening — not a full plan.
              </p>

              <ul className="space-y-3 mb-8 flex-grow">
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                  Single response from Rick's system
                </li>
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                  Priority + direction identified
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

            {/* In-Person Assessment */}
            <div className="bg-slate-900/80 border-2 border-red-500/50 rounded-2xl p-8 flex flex-col relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-red-600 rounded-full text-xs font-bold text-white uppercase tracking-wider">
                Most Popular
              </div>
              
              <div className="mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/20 rounded-full mb-4">
                  <Target className="w-4 h-4 text-red-400" />
                  <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Truth Session</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">In-Person Assessment</h3>
                <div className="text-4xl font-black text-white mb-2">$399</div>
                <p className="text-slate-500 text-sm">One-time investment</p>
              </div>
              
              <p className="text-slate-400 text-sm mb-6">
                90 minutes with me. Full evaluation. Real answers.
              </p>

              <ul className="space-y-3 mb-8 flex-grow">
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <Check className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  Full 4B evaluation in person
                </li>
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <Check className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  Video analysis + drill instruction
                </li>
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <Check className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  30-day plan + 2-week support
                </li>
              </ul>

              <Button asChild className="w-full bg-red-600 hover:bg-red-700 text-white font-bold">
                <Link to="/assessment">Book Assessment</Link>
              </Button>
            </div>

            {/* 90-Day Transformation */}
            <div className="bg-gradient-to-b from-slate-900 to-slate-900/80 border border-yellow-500/30 rounded-2xl p-8 flex flex-col">
              <div className="mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-500/20 rounded-full mb-4">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  <span className="text-xs font-bold text-yellow-400 uppercase tracking-wider">Flagship</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">90-Day Transformation</h3>
                <div className="text-2xl font-black text-white mb-1">Starts at $1,299</div>
                <p className="text-slate-500 text-sm">Founders / Offseason Rate (limited)</p>
              </div>
              
              <p className="text-slate-400 text-sm mb-6">
                Real change. Structured development. For players done guessing.
              </p>

              <ul className="space-y-3 mb-8 flex-grow">
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <Check className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                  Full assessment + structured training
                </li>
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <Check className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                  Ongoing feedback + adjustments
                </li>
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <Check className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                  Direct access to Rick
                </li>
              </ul>

              <Button asChild className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold">
                <Link to="/apply">Apply Now</Link>
              </Button>
            </div>

          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-slate-900/50 border-y border-slate-800">
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