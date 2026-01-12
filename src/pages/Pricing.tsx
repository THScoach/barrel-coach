import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight, MessageCircle, Zap, Users, Clock } from "lucide-react";
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
    question: "What's the $37 KRS Assessment?",
    answer: "Your full KRS 4B report (Brain, Body, Bat, Ball), AI-powered explanation of your results, and starter drills to begin fixing your #1 issue. One-time purchase, instant access.",
  },
  {
    question: "What's included in the membership?",
    answer: "Weekly Monday night live group calls with Coach Rick, unlimited swing uploads with KRS reports, Rick AI for instant answers, My Swing Lab access, monthly retests to track progress, and seasonal in-season/off-season guidance. Cancel anytime.",
  },
  {
    question: "What's the Founding Annual rate?",
    answer: "The $899/year founding rate saves you ~24% vs monthly ($1,188/year). It's only available to early members who join before March 1, and the rate is locked in as long as you stay active.",
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
            CHOOSE HOW YOU WANT COACHING
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            No applications. No upsells. Just coaching.
          </p>
        </div>
      </section>

      {/* Pricing Cards — 3 Only */}
      <section className="pb-20">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-6">
            
            {/* 1. Free Diagnostic — $0 */}
            <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-8 flex flex-col">
              <div className="mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-800 rounded-full mb-4">
                  <MessageCircle className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Start Here</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Free Diagnostic</h3>
                <div className="text-4xl font-black text-white mb-2">$0</div>
                <p className="text-slate-500 text-sm">One-time</p>
              </div>
              
              <ul className="space-y-3 mb-6 flex-grow">
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                  One swing upload
                </li>
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                  Snapshot of what's happening
                </li>
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                  Direction, not coaching
                </li>
              </ul>

              <p className="text-slate-500 text-sm mb-6 border-t border-slate-800 pt-4">
                This tells you what's wrong.<br />
                It does not fix it.
              </p>

              <Button asChild className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold">
                <a href="https://link.hittingskool.com/payment-link/69657dcc94977cdce1d062c6" target="_blank" rel="noopener noreferrer">Get Free Diagnostic</a>
              </Button>
            </div>

            {/* 2. KRS Assessment — $37 */}
            <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-8 flex flex-col">
              <div className="mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 rounded-full mb-4">
                  <Zap className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">One-Time</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">KRS Assessment</h3>
                <div className="text-4xl font-black text-white mb-2">$37</div>
                <p className="text-slate-500 text-sm">One-time purchase</p>
              </div>
              
              <ul className="space-y-3 mb-6 flex-grow">
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <Check className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  Full KRS 4B Report
                </li>
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <Check className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  AI-powered explanation
                </li>
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <Check className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  Starter drills to fix your #1 issue
                </li>
              </ul>

              <p className="text-slate-500 text-sm mb-6 border-t border-slate-800 pt-4">
                Get the full picture.<br />
                Know exactly what to work on.
              </p>

              <Button asChild className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold">
                <a href="https://link.hittingskool.com/payment-link/69657e1494977c2574d06359" target="_blank" rel="noopener noreferrer">Get KRS Assessment</a>
              </Button>
            </div>

            {/* 3. Catching Barrels Membership — $99/month OR $899/year (FEATURED) */}
            <div className="bg-slate-900/80 border-2 border-red-500/50 rounded-2xl p-8 flex flex-col relative ring-2 ring-red-500/30">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-red-600 rounded-full text-xs font-bold text-white uppercase tracking-wider">
                Most Popular
              </div>
              
              <div className="mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/20 rounded-full mb-4">
                  <Users className="w-4 h-4 text-red-400" />
                  <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Ongoing</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Catching Barrels Membership</h3>
                
                {/* Pricing Options */}
                <div className="space-y-2 mb-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-white">$99</span>
                    <span className="text-lg text-slate-400">/month</span>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <Clock className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl font-bold text-white">$899</span>
                        <span className="text-sm text-slate-400">/year</span>
                        <span className="text-xs font-bold text-yellow-400 bg-yellow-500/20 px-2 py-0.5 rounded">Save ~24%</span>
                      </div>
                      <p className="text-xs text-yellow-400/80">Founding Annual Rate – until March 1</p>
                    </div>
                  </div>
                </div>
                <p className="text-slate-500 text-sm">Cancel anytime</p>
              </div>
              
              <ul className="space-y-3 mb-6 flex-grow">
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <Check className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  Full KRS reports included
                </li>
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <Check className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  My Swing Lab access
                </li>
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <Check className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  Weekly Monday night coaching calls
                </li>
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <Check className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  Rick AI for instant answers
                </li>
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <Check className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  Monthly retests to track progress
                </li>
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <Check className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  Seasonal guidance (in-season / off-season)
                </li>
              </ul>

              <p className="text-slate-500 text-sm mb-6 border-t border-slate-800 pt-4">
                This is real coaching.<br />
                Show up. Upload swings. Improve.
              </p>

              <Button asChild className="w-full bg-red-600 hover:bg-red-700 text-white font-bold">
                <a href="https://link.hittingskool.com/payment-link/69657e5c3e9f2f549c38ab1f" target="_blank" rel="noopener noreferrer">Join Membership</a>
              </Button>
            </div>

          </div>
        </div>
      </section>

      {/* Bottom Note */}
      <section className="pb-16">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <p className="text-lg text-slate-400 italic">
            "If you want results, consistency beats information every time."
          </p>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 border-t border-slate-800">
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
            <Link to="/diagnostic">
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
