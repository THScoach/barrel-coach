import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import {
  Check,
  Clock,
  Video,
  FileText,
  MessageCircle,
  MapPin,
  Target,
  Users,
  Wrench,
  Loader2,
  Shield,
  ArrowRight
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import rickCoaching from '@/assets/rick-coaching-1.jpg';

const timeline = [
  { time: '0-15 min', title: 'Warmup & Baseline', description: "We'll get you loose and I'll observe your natural movement patterns before any coaching." },
  { time: '15-45 min', title: 'Video Analysis', description: "Multiple angles, slow motion breakdown. I'll show you exactly what's happening in your swing and why." },
  { time: '45-75 min', title: 'Drill Work', description: "Hands-on correction. We'll work on your #1 priority until you FEEL the difference." },
  { time: '75-90 min', title: 'Training Plan', description: "You'll leave with a written 30-day drill plan and video references for everything we covered." },
];

const deliverables = [
  'Full 4B Swing Score with detailed breakdown',
  'Video clips of your session (before/after)',
  '30-day personalized drill plan',
  'Access to relevant videos in the drill library',
  '2 weeks of follow-up text support',
];

const personas = [
  { icon: Target, title: 'Serious Players', description: 'High school, college, or pro players who want professional-level analysis and coaching.' },
  { icon: Users, title: 'Parents & Players', description: 'Come together. Parents learn what to look for, players learn what to feel.' },
  { icon: FileText, title: 'Coaches', description: 'Learn the 4B System firsthand. Bring a player or come solo for professional development.' },
  { icon: Wrench, title: 'Struggling Hitters', description: "Stuck in a slump? Can't figure out what's wrong? 90 minutes will give you clarity." },
];

const faqs = [
  { question: "How do I schedule after I pay?", answer: "You'll receive an email with a scheduling link immediately after payment. Pick any available slot that works for you." },
  { question: "What should I bring?", answer: "Your bat, batting gloves, and cleats/turf shoes. Wear comfortable athletic clothes. I provide everything else." },
  { question: "Can my parent/coach come?", answer: "Absolutely. In fact, I encourage it. They'll learn what to look for and can help reinforce the training at home." },
  { question: "What ages do you work with?", answer: "10 and up. The assessment is tailored to the player's age and skill level." },
  { question: "What if I need to reschedule?", answer: "No problem. Reschedule up to 24 hours before with no penalty. Less than 24 hours may require a $50 rebooking fee." },
  { question: "Do you travel for assessments?", answer: "For teams or groups of 5+, yes. Contact me directly for team rates and travel arrangements." },
];

export default function Assessment() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleBook = async () => {
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-assessment-checkout', { body: { email } });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      console.error('Checkout failed:', error);
      toast.error('Failed to start checkout. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      <Header />

      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl" />
        </div>
        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-full text-slate-300 text-sm mb-6">
              <Clock className="w-4 h-4 text-red-400" />
              90 Minutes • In-Person
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              In-Person Assessment
            </h1>
            <p className="text-xl text-slate-300 mb-4 max-w-2xl mx-auto">
              One session. Real answers.
            </p>
            <p className="text-lg text-slate-400 mb-8 max-w-2xl mx-auto">
              90 minutes with me, face-to-face. Full 4B evaluation, video analysis, and a training plan you can actually use.
            </p>
            <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 max-w-md mx-auto">
              <p className="text-5xl font-bold text-white mb-2">$399</p>
              <p className="text-slate-400 mb-6">One-time investment</p>
              <Input
                type="email"
                placeholder="Enter your email to book"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 mb-4"
              />
              <Button onClick={handleBook} disabled={isLoading} className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3">
                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</> : <>Book Now <ArrowRight className="ml-2 h-4 w-4" /></>}
              </Button>
              <div className="flex items-center justify-center gap-2 mt-4 text-sm text-slate-400">
                <Shield className="w-4 h-4 text-green-400" />
                Secure checkout via Stripe
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-20 border-t border-slate-800">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-white text-center mb-12">What to Expect</h2>
          <div className="space-y-6">
            {timeline.map((item, index) => (
              <div key={item.title} className="flex gap-4 md:gap-6">
                <div className="flex-shrink-0 w-20 md:w-24 text-right">
                  <span className="inline-block bg-red-500/20 text-red-400 px-3 py-1 rounded-lg text-xs font-semibold">
                    {item.time}
                  </span>
                </div>
                <div className="relative flex items-center justify-center">
                  <div className="w-3 h-3 bg-red-500 rounded-full z-10" />
                  {index < timeline.length - 1 && <div className="absolute top-3 left-1/2 -translate-x-1/2 w-0.5 h-full bg-slate-700" />}
                </div>
                <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl flex-1 pb-6">
                  <h3 className="font-semibold text-lg text-white mb-1">{item.title}</h3>
                  <p className="text-slate-400 text-sm">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Deliverables */}
      <section className="py-20 bg-slate-900/50">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-white text-center mb-12">What You Get</h2>
          <div className="space-y-4">
            {deliverables.map((item, index) => (
              <div key={index} className="flex items-center gap-4 bg-slate-800/50 border border-slate-700 p-4 rounded-xl">
                <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <Check className="w-4 h-4 text-green-400" />
                </div>
                <span className="text-slate-200">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who It's For */}
      <section className="py-20 border-t border-slate-800">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-white text-center mb-12">Who This Is For</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {personas.map((persona, index) => (
              <div key={index} className="bg-slate-900/80 border border-slate-800 p-6 rounded-xl text-center">
                <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <persona.icon className="w-6 h-6 text-red-400" />
                </div>
                <h3 className="font-semibold text-white mb-2">{persona.title}</h3>
                <p className="text-sm text-slate-400">{persona.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Location */}
      <section className="py-20 bg-slate-900/50">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
            <MapPin className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">Training Location</h2>
          <p className="text-slate-300 mb-2">Sessions held at my private training facility</p>
          <p className="text-slate-500">Address provided upon booking confirmation</p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 border-t border-slate-800">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-white text-center mb-12">Questions?</h2>
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`} className="bg-slate-900/80 border border-slate-800 rounded-xl px-6">
                <AccordionTrigger className="text-left font-semibold text-white hover:no-underline py-4">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-slate-400 pb-4">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-gradient-to-r from-red-900/30 to-orange-900/30 border-t border-slate-800">
        <div className="max-w-xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready for the Truth?</h2>
          <p className="text-slate-300 mb-8">Book your 90-minute session today.</p>
          <Button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-full font-semibold"
          >
            Book for $399 <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
