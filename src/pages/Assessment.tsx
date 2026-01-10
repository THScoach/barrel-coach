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
  Shield
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
  {
    time: '0-15 min',
    title: 'Warmup & Baseline',
    description: "We'll get you loose and I'll observe your natural movement patterns before any coaching.",
  },
  {
    time: '15-45 min',
    title: 'Video Analysis',
    description: "Multiple angles, slow motion breakdown. I'll show you exactly what's happening in your swing and why.",
  },
  {
    time: '45-75 min',
    title: 'Drill Work',
    description: "Hands-on correction. We'll work on your #1 priority until you FEEL the difference.",
  },
  {
    time: '75-90 min',
    title: 'Training Plan',
    description: "You'll leave with a written 30-day drill plan and video references for everything we covered.",
  },
];

const deliverables = [
  'Full 4B Swing Score with detailed breakdown',
  'Video clips of your session (before/after)',
  '30-day personalized drill plan',
  'Access to relevant videos in the drill library',
  '2 weeks of follow-up text support',
];

const personas = [
  {
    icon: Target,
    title: 'Serious Players',
    description: 'High school, college, or pro players who want professional-level analysis and coaching.',
  },
  {
    icon: Users,
    title: 'Parents & Players',
    description: 'Come together. Parents learn what to look for, players learn what to feel.',
  },
  {
    icon: FileText,
    title: 'Coaches',
    description: 'Learn the 4B System firsthand. Bring a player or come solo for professional development.',
  },
  {
    icon: Wrench,
    title: 'Struggling Hitters',
    description: "Stuck in a slump? Can't figure out what's wrong? 90 minutes will give you clarity.",
  },
];

const faqs = [
  {
    question: "How do I schedule after I pay?",
    answer: "You'll receive an email with a scheduling link immediately after payment. Pick any available slot that works for you.",
  },
  {
    question: "What should I bring?",
    answer: "Your bat, batting gloves, and cleats/turf shoes. Wear comfortable athletic clothes. I provide everything else.",
  },
  {
    question: "Can my parent/coach come?",
    answer: "Absolutely. In fact, I encourage it. They'll learn what to look for and can help reinforce the training at home.",
  },
  {
    question: "What ages do you work with?",
    answer: "10 and up. The assessment is tailored to the player's age and skill level.",
  },
  {
    question: "What if I need to reschedule?",
    answer: "No problem. Reschedule up to 24 hours before with no penalty. Less than 24 hours may require a $50 rebooking fee.",
  },
  {
    question: "Do you travel for assessments?",
    answer: "For teams or groups of 5+, yes. Contact me directly for team rates and travel arrangements.",
  },
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
      const { data, error } = await supabase.functions.invoke('create-assessment-checkout', {
        body: { email },
      });

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
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <span className="inline-flex items-center gap-2 bg-accent/20 text-accent px-4 py-2 rounded-full text-sm font-semibold mb-6">
              <MapPin className="w-4 h-4" />
              St. Louis, MO Area
            </span>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              In-Person Assessment
            </h1>
            <p className="text-xl text-primary-foreground/80 mb-8 max-w-2xl mx-auto">
              90 minutes with Coach Rick. Full biomechanical analysis, 
              video breakdown, and personalized training plan.
            </p>
            <div className="flex items-baseline justify-center gap-2 mb-6">
              <span className="text-5xl md:text-6xl font-bold text-accent">$299</span>
              <span className="text-xl text-primary-foreground/70">one session</span>
            </div>
            <Button 
              variant="hero" 
              size="xl" 
              onClick={() => document.getElementById('book')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Book Your Assessment
            </Button>
          </div>
        </div>
      </section>

      {/* What You Get - Timeline */}
      <section className="py-20 bg-background">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">What's Included</h2>
            
            {/* Timeline */}
            <div className="relative mb-16">
              <div className="absolute left-[52px] top-0 bottom-0 w-0.5 bg-border hidden md:block" />
              
              <div className="space-y-8">
                {timeline.map((step, index) => (
                  <div key={step.title} className="flex gap-6 items-start">
                    <div className="flex-shrink-0 w-[105px] text-right hidden md:block">
                      <span className="inline-block bg-accent/10 text-accent px-3 py-1 rounded-lg text-sm font-semibold">
                        {step.time}
                      </span>
                    </div>
                    <div className="hidden md:flex w-6 h-6 rounded-full bg-accent items-center justify-center flex-shrink-0 mt-1 relative z-10">
                      <div className="w-2 h-2 bg-background rounded-full" />
                    </div>
                    <div className="bg-card p-6 rounded-xl shadow-sm flex-1">
                      <span className="md:hidden inline-block bg-accent/10 text-accent px-3 py-1 rounded-lg text-sm font-semibold mb-3">
                        {step.time}
                      </span>
                      <h3 className="font-semibold text-lg mb-2">{step.title}</h3>
                      <p className="text-muted-foreground">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Deliverables */}
            <div className="bg-card p-8 rounded-2xl border border-border">
              <h3 className="font-bold text-xl mb-6">You'll Leave With:</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                {deliverables.map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Coach Rick */}
      <section className="py-20 bg-surface">
        <div className="container">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="aspect-square rounded-2xl overflow-hidden">
                <img 
                  src={rickCoaching} 
                  alt="Coach Rick" 
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h2 className="text-3xl md:text-4xl font-bold mb-4">Train With Coach Rick</h2>
                <p className="text-lg text-muted-foreground mb-6">
                  20+ years of professional coaching experience. 
                  AAA Hitting Coach with the Baltimore Orioles organization. 
                  Trained 78+ pro players including MLB All-Stars.
                </p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-accent">
                    <span className="text-xl">🏆</span>
                    <span>3 Silver Slugger Award Winners</span>
                  </div>
                  <div className="flex items-center gap-3 text-accent">
                    <span className="text-xl">⚾</span>
                    <span>78+ Professional Players Trained</span>
                  </div>
                  <div className="flex items-center gap-3 text-accent">
                    <span className="text-xl">📊</span>
                    <span>Creator of the 4B System</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Who It's For */}
      <section className="py-20 bg-background">
        <div className="container">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">Perfect For</h2>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {personas.map((persona) => (
                <div key={persona.title} className="bg-card p-6 rounded-xl shadow-sm text-center">
                  <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                    <persona.icon className="w-6 h-6 text-accent" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{persona.title}</h3>
                  <p className="text-sm text-muted-foreground">{persona.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Location */}
      <section className="py-20 bg-surface">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">Location</h2>
            
            <div className="bg-card p-8 rounded-2xl">
              <div className="grid md:grid-cols-2 gap-8">
                <div className="aspect-video bg-muted rounded-xl flex items-center justify-center">
                  <MapPin className="w-16 h-16 text-accent/30" />
                </div>
                <div>
                  <h3 className="font-bold text-xl mb-2">St. Louis, Missouri Area</h3>
                  <p className="text-muted-foreground mb-4">
                    Sessions held at indoor/outdoor facilities near downtown.
                    Exact address provided upon booking.
                  </p>
                  
                  <div className="bg-accent/10 p-4 rounded-lg">
                    <p className="font-semibold text-accent mb-2">Not local?</p>
                    <p className="text-sm text-muted-foreground">
                      Flying in for an assessment? Many players do. 
                      St. Louis Lambert Airport (STL) is 20 minutes away. 
                      Worth the trip for serious players.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-background">
        <div className="container">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">Questions</h2>
            
            <Accordion type="single" collapsible className="space-y-4">
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`} className="bg-card rounded-lg px-6 border-none">
                  <AccordionTrigger className="text-left font-semibold hover:no-underline">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section id="book" className="py-20 bg-primary text-primary-foreground">
        <div className="container">
          <div className="max-w-xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              90 Minutes That Could Change Everything
            </h2>
            <p className="text-lg text-primary-foreground/80 mb-8">
              Most players spend years guessing. One session gives you 
              clarity on exactly what to work on and how.
            </p>
            
            <div className="bg-primary-foreground/10 p-8 rounded-2xl backdrop-blur">
              <div className="flex items-baseline justify-center gap-2 mb-6">
                <span className="text-5xl font-bold text-accent">$299</span>
                <span className="text-lg text-primary-foreground/70">one session</span>
              </div>
              
              <div className="space-y-4 mb-6">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="text-center text-lg py-6 bg-background text-foreground"
                />
                <Button 
                  variant="hero" 
                  size="xl" 
                  className="w-full"
                  onClick={handleBook}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Book Your Assessment — $299'
                  )}
                </Button>
              </div>

              <div className="flex items-center gap-3 justify-center p-4 bg-background/10 rounded-lg">
                <Shield className="w-6 h-6 text-success" />
                <p className="text-sm text-primary-foreground/80">
                  After payment, you'll receive a link to schedule your session.
                  Most sessions available within 2 weeks.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
