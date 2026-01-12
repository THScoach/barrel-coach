import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight, MessageCircle, Users, MapPin } from "lucide-react";
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
    question: "What's included in the $99/month coaching?",
    answer: "Weekly Monday night live group calls, swing uploads with personal feedback, SMS communication with me, and ongoing coaching throughout the month. Cancel anytime.",
  },
  {
    question: "What's the $299 in-person assessment?",
    answer: "90 minutes with me, face-to-face. Full 4B evaluation, video analysis, drill work, and a 30-day training plan you can actually use.",
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
            WORK WITH COACH RICK
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Three ways to get started. No applications. No upsells. Just coaching.
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
                <h3 className="text-xl font-bold text-white mb-2">Free Swing Diagnostic</h3>
                <div className="text-4xl font-black text-white mb-2">$0</div>
                <p className="text-slate-500 text-sm">One-time snapshot</p>
              </div>
              
              <p className="text-slate-400 text-sm mb-6">
                One clear answer. No guesswork.
              </p>

              <ul className="space-y-3 mb-8 flex-grow">
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                  Upload a swing
                </li>
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                  Short analysis from Rick
                </li>
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                  Delivered via SMS
                </li>
              </ul>

              <Button asChild className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold">
                <Link to="/diagnostic">Get My Free Swing Diagnostic</Link>
              </Button>
            </div>

            {/* 2. Online Coaching — $99/month (FEATURED) */}
            <div className="bg-slate-900/80 border-2 border-red-500/50 rounded-2xl p-8 flex flex-col relative ring-2 ring-red-500/30">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-red-600 rounded-full text-xs font-bold text-white uppercase tracking-wider">
                Primary Product
              </div>
              
              <div className="mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/20 rounded-full mb-4">
                  <Users className="w-4 h-4 text-red-400" />
                  <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Ongoing</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Online Coaching</h3>
                <div className="text-4xl font-black text-white mb-2">$99<span className="text-lg text-slate-400">/mo</span></div>
                <p className="text-slate-500 text-sm">Cancel anytime</p>
              </div>
              
              <p className="text-slate-400 text-sm mb-6">
                Weekly calls. Swing feedback. Direct access.
              </p>

              <ul className="space-y-3 mb-8 flex-grow">
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <Check className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  Weekly Monday night live call
                </li>
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <Check className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  Swing uploads & feedback
                </li>
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <Check className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  SMS communication with Rick
                </li>
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <Check className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  Ongoing monthly coaching
                </li>
              </ul>

              <Button asChild className="w-full bg-red-600 hover:bg-red-700 text-white font-bold">
                <Link to="/coaching">Join Online Coaching ($99/month)</Link>
              </Button>
            </div>

            {/* 3. In-Person Assessment — $299 */}
            <div className="bg-slate-900/80 border border-yellow-500/30 rounded-2xl p-8 flex flex-col relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-yellow-500 rounded-full text-xs font-bold text-black uppercase tracking-wider">
                Limited Time
              </div>
              
              <div className="mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-500/20 rounded-full mb-4">
                  <MapPin className="w-4 h-4 text-yellow-400" />
                  <span className="text-xs font-bold text-yellow-400 uppercase tracking-wider">In-Person</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">In-Person Assessment</h3>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-4xl font-black text-white">$299</span>
                  <span className="text-lg text-slate-500 line-through">$399</span>
                </div>
                <p className="text-slate-500 text-sm">One-time • 90 minutes</p>
              </div>
              
              <p className="text-slate-400 text-sm mb-6">
                Face-to-face with Rick. Full evaluation.
              </p>

              <ul className="space-y-3 mb-8 flex-grow">
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <Check className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                  In-person swing evaluation
                </li>
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <Check className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                  Full swing breakdown
                </li>
                <li className="flex items-start gap-3 text-slate-300 text-sm">
                  <Check className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                  Development recommendations
                </li>
              </ul>

              <Button asChild className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold">
                <Link to="/assessment">Book In-Person Assessment ($299)</Link>
              </Button>
              <p className="text-xs text-slate-500 mt-3 text-center">This price is only available until I leave for spring training.</p>
            </div>

          </div>
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
