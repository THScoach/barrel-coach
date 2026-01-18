import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight, Gift, BarChart3, Video, Users, Unlock, Phone, MessageCircle, ClipboardList, AlertTriangle, Crown } from "lucide-react";
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
    question: "Is the diagnostic really free?",
    answer: "Yes. 100% free. No credit card. Upload your swing, get your Motor Profile and PDF report delivered via email. No drills. No guessing.",
  },
  {
    question: "Is the sensor really free?",
    answer: "Yes. When you join The Academy, we ship you a Diamond Kinetics smart sensor (retail $150) at no extra cost. It's yours to keep, even if you cancel.",
  },
  {
    question: "What if I already have a sensor?",
    answer: "Perfect! Connect it to your account and start tracking immediately. We support Diamond Kinetics, Blast Motion, and can import data from other systems.",
  },
  {
    question: "What is Monday Night Film Room?",
    answer: "Every Monday at 8pm ET, Coach Rick hosts a live group session where he reviews member swings, answers questions, and breaks down what he's seeing. It's like having a private coach for the price of a batting cage session.",
  },
  {
    question: "How is Inner Circle different from The Academy?",
    answer: "Inner Circle includes everything in The Academy plus 2x monthly private video lessons with Coach Rick, direct chat access, custom training plans, and priority analysis. Limited to 20 players.",
  },
  {
    question: "Can I cancel anytime?",
    answer: "Absolutely. No contracts, no commitments. Cancel with one click. But most players stay because they see real results.",
  },
  {
    question: "Can I upgrade from Academy to Inner Circle later?",
    answer: "Yes, if spots are available. Inner Circle is capped at 20 players to ensure quality 1-on-1 time with Coach Rick.",
  },
  {
    question: "Is this for youth / college / pro?",
    answer: "All of the above. The 4B System works at every level. I've used it with 10-year-olds and MLB players. The principles don't change — the details do.",
  },
];

export default function Pricing() {
  const navigate = useNavigate();

  const handleCheckout = async (tier: 'academy' | 'inner-circle') => {
    try {
      const { data, error } = await supabase.functions.invoke('create-subscription-checkout', {
        body: { tier }
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

      {/* Philosophy Quote */}
      <section className="pt-32 pb-12">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <blockquote className="text-2xl md:text-3xl font-light text-slate-300 italic">
            "I want to coach you, not be an accountant.
            <span className="block mt-2 text-white font-medium not-italic">Just coaching."</span>
          </blockquote>
          <p className="mt-4 text-slate-500">— Coach Rick Strickland</p>
        </div>
      </section>

      {/* Pricing Cards — 3 Tiers */}
      <section className="pb-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-6 items-start">
            
            {/* 1. Kinetic DNA Diagnostic — FREE */}
            <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-6 flex flex-col">
              <div className="text-teal-400 text-xs font-bold uppercase tracking-wider mb-2">
                START HERE
              </div>
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-white mb-2">Kinetic DNA Diagnostic</h3>
                <div className="text-5xl font-black text-white mb-2">FREE</div>
              </div>
              
              <ul className="space-y-3 mb-6 flex-grow">
                <li className="flex items-start gap-3 text-slate-300">
                  <Check className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
                  <span>Motor Profile Assessment</span>
                </li>
                <li className="flex items-start gap-3 text-slate-300">
                  <Check className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
                  <span>PDF report delivered via email</span>
                </li>
              </ul>

              <Button asChild variant="outline" className="w-full border-slate-600 hover:bg-slate-800 text-white font-bold py-6 text-lg">
                <Link to="/diagnostic">Get Your Free Diagnostic</Link>
              </Button>
            </div>

            {/* 2. THE ACADEMY — $99/month (MOST POPULAR) */}
            <div className="bg-slate-900 border-2 border-teal-500 rounded-2xl p-8 flex flex-col relative ring-4 ring-teal-500/30 scale-105 shadow-2xl shadow-teal-500/20 md:-mt-4 md:mb-4">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-6 py-2 bg-teal-500 rounded-full text-sm font-bold text-white uppercase tracking-wider">
                Most Popular
              </div>
              
              <div className="mb-6 pt-2">
                <h3 className="text-2xl font-bold text-white mb-2">The Academy</h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-black text-white">$99</span>
                  <span className="text-xl text-slate-400">/month</span>
                </div>
              </div>

              <ul className="space-y-4 mb-8 flex-grow">
                {/* FREE SENSOR KIT - HIGHLIGHTED */}
                <li className="flex items-start gap-3 p-3 bg-gradient-to-r from-amber-500/20 to-orange-500/10 border border-amber-500/40 rounded-xl">
                  <Gift className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-amber-300 font-bold">🎁 FREE Smart Sensor Kit</span>
                    <span className="block text-amber-400/80 text-sm">(We ship it today)</span>
                  </div>
                </li>
                
                <li className="flex items-start gap-3 text-slate-200">
                  <Check className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
                  <span>📊 Daily Kinetic DNA Tracking</span>
                </li>
                <li className="flex items-start gap-3 text-slate-200">
                  <Check className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
                  <span>🎥 Auto-Video Analysis (Sensor triggers camera)</span>
                </li>
                <li className="flex items-start gap-3 text-slate-200">
                  <Check className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
                  <span>⚾ Monday Night Film Room (Live Group Coaching)</span>
                </li>
                <li className="flex items-start gap-3 text-slate-200">
                  <Check className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
                  <span>🔓 Full Drill Library Access</span>
                </li>
                <li className="flex items-start gap-3 text-slate-200">
                  <Check className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
                  <span>👥 Community & Challenges</span>
                </li>
              </ul>

              <Button 
                onClick={() => handleCheckout('academy')}
                className="w-full bg-teal-500 hover:bg-teal-600 text-white font-bold py-6 text-lg"
              >
                Join The Academy
              </Button>
            </div>

            {/* 3. INNER CIRCLE — $199/month (LIMITED) */}
            <div className="bg-gradient-to-b from-slate-900 to-red-950/30 border-2 border-red-500/50 rounded-2xl p-6 flex flex-col relative">
              {/* LIMITED Badge */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-red-600 rounded-full text-xs font-bold text-white uppercase tracking-wider">
                Limited
              </div>
              
              <div className="mb-6 pt-4">
                <h3 className="text-2xl font-bold text-white mb-2">Inner Circle</h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-black text-white">$199</span>
                  <span className="text-xl text-slate-400">/month</span>
                </div>
              </div>

              <ul className="space-y-4 mb-6 flex-grow">
                {/* Everything in Academy */}
                <li className="flex items-start gap-3 text-slate-200">
                  <Check className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <span className="font-semibold">✅ Everything in The Academy</span>
                </li>
                
                <li className="flex items-start gap-3 text-slate-200">
                  <Check className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <span>📞 2x Monthly Private Video Lessons (Zoom)</span>
                </li>
                <li className="flex items-start gap-3 text-slate-200">
                  <Check className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <span>💬 Direct Chat Access (Skip the line)</span>
                </li>
                <li className="flex items-start gap-3 text-slate-200">
                  <Check className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <span>📉 Custom Training Plan adjustments</span>
                </li>
              </ul>

              {/* Limited Spots Warning */}
              <div className="flex items-center justify-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg mb-6">
                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <span className="text-red-400 text-sm font-semibold">⚠️ Limited to 20 players</span>
              </div>

              <Button 
                onClick={() => handleCheckout('inner-circle')}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-6 text-lg"
              >
                Apply to Inner Circle
              </Button>
            </div>

          </div>
        </div>
      </section>

      {/* Value Comparison */}
      <section className="pb-16">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/5 border border-amber-500/30 rounded-2xl p-8 text-center">
            <Gift className="w-12 h-12 text-amber-400 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-white mb-2">The Academy Value</h3>
            <p className="text-slate-300 mb-4">
              Your first month includes the <span className="text-amber-400 font-bold">FREE Smart Sensor Kit</span> (retail $150).
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
            Common Questions
          </h2>
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`faq-${index}`} className="border-slate-800">
                <AccordionTrigger className="text-white hover:text-teal-400 text-left">
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
            Ready to stop guessing?
          </h2>
          <p className="text-slate-400 mb-8">
            Get your free Kinetic DNA Diagnostic and see exactly what's holding you back.
          </p>
          <Button asChild size="lg" className="bg-teal-500 hover:bg-teal-600 text-white font-bold px-8 py-6 text-lg">
            <Link to="/diagnostic" className="flex items-center gap-2">
              Start Your Free Diagnostic
              <ArrowRight className="w-5 h-5" />
            </Link>
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
