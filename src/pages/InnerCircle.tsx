import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { 
  Check, 
  MessageCircle, 
  Video, 
  Users, 
  ChartBar, 
  Calendar, 
  Percent, 
  Shield, 
  Loader2,
  X
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import fourBSystemGraphic from '@/assets/4b-system-graphic.png';

const features = [
  {
    icon: Video,
    title: 'Full Video Library',
    description: '200+ exclusive drill videos organized by the 4B System. New content added weekly.',
  },
  {
    icon: Calendar,
    title: 'Weekly Live Calls',
    description: 'Every Monday at 7pm CST. Group Q&A sessions with Coach Rick. Get your swing questions answered in real-time.',
  },
  {
    icon: ChartBar,
    title: 'Unlimited Swing Reviews',
    description: 'Submit swings anytime. Get 4B analysis and personalized drill prescriptions.',
  },
  {
    icon: MessageCircle,
    title: 'Direct Access',
    description: 'Text Coach Rick directly with questions. Priority response within 24 hours.',
  },
  {
    icon: Users,
    title: 'Private Community',
    description: 'Connect with other serious players and coaches. Share wins, get feedback.',
  },
  {
    icon: Percent,
    title: 'Member Discounts',
    description: '20% off in-person assessments, camps, and any future products.',
  },
];

const whoIsThisFor = [
  "You're serious about making varsity, college, or pro ball",
  "You want ongoing coaching, not just a one-time analysis",
  "You're willing to put in the work between sessions",
  "You want direct access when you have questions",
  "You're a coach looking to level up your knowledge",
];

const testimonials = [
  {
    quote: "The monthly calls alone are worth it. Getting real-time feedback on my son's swing has been a game-changer.",
    name: "Mike D.",
    role: "Baseball Dad, Texas",
  },
  {
    quote: "I've learned more in 3 months than 5 years of lessons. The 4B System finally made it click.",
    name: "Jason T.",
    role: "High School Coach",
  },
  {
    quote: "Direct text access to Coach Rick? That's insane value. I use it every week.",
    name: "Marcus W.",
    role: "College Commit",
  },
];

const faqs = [
  {
    question: "Can I cancel anytime?",
    answer: "Yes. No contracts, no commitments. Cancel with one click anytime from your account settings. You'll keep access until the end of your billing period.",
  },
  {
    question: "How do the live calls work?",
    answer: "We do group Zoom calls every Monday at 7pm CST. You can submit swings beforehand or ask questions live. Calls are recorded if you can't make it.",
  },
  {
    question: "How quickly will Coach Rick respond?",
    answer: "Priority members get responses within 24 hours, usually much faster. For urgent game-day questions, same-day responses are common.",
  },
  {
    question: "Is this for kids or adults?",
    answer: "Both. The 4B System works for any age. We have members from 10-year-olds to adult rec league players to coaches in their 60s.",
  },
  {
    question: "What if I'm already a customer?",
    answer: "Any previous purchases ($37 or $97) count toward your first month. Just email us after joining for a credit.",
  },
];

const comparisonData = [
  { feature: '4B Swing Analysis', single: '1 swing', complete: '5 swings', inner: 'Unlimited' },
  { feature: 'Video Library Access', single: 'Limited', complete: '30 days', inner: 'Full access' },
  { feature: 'Drill Prescription', single: '1 drill', complete: '30-day plan', inner: 'Ongoing plans' },
  { feature: 'Direct Access to Coach Rick', single: false, complete: false, inner: true },
  { feature: 'Weekly Live Calls', single: false, complete: false, inner: true },
  { feature: 'Private Community', single: false, complete: false, inner: true },
];

export default function InnerCircle() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleCheckout = async () => {
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-inner-circle-checkout', {
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
            <span className="inline-block bg-accent/20 text-accent px-4 py-2 rounded-full text-sm font-semibold mb-6">
              For Serious Players Only
            </span>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              The Inner Circle
            </h1>
            <p className="text-xl text-primary-foreground/80 mb-8 max-w-2xl mx-auto">
              Monthly access to Coach Rick's complete training system, 
              video library, and live coaching calls.
            </p>
            <div className="flex items-baseline justify-center gap-1 mb-6">
              <span className="text-5xl md:text-6xl font-bold text-accent">$297</span>
              <span className="text-xl text-primary-foreground/70">/month</span>
            </div>
            <Button 
              variant="hero" 
              size="xl" 
              onClick={() => document.getElementById('join')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Join Inner Circle
            </Button>
            <p className="text-sm text-primary-foreground/60 mt-4">
              Cancel anytime. No contracts.
            </p>
          </div>
        </div>
      </section>

      {/* The 4B System Framework */}
      <section className="py-20 bg-surface">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">The Coaching Framework</h2>
            <p className="text-center text-muted-foreground mb-8">
              Every swing review, drill prescription, and coaching call is built around the 4B System
            </p>
            
            <div className="bg-card rounded-xl p-4 md:p-8 shadow-card">
              <img 
                src={fourBSystemGraphic} 
                alt="The 4B Hitting System - Brain (Timing, Sync, Pattern Recognition), Body (Ground-Up Sequencing, Force Creation), Bat (Barrel Control, Transfer Efficiency), Ball (Contact Quality, Exit Velocity)" 
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      </section>

      {/* What's Included */}
      <section className="py-20 bg-background">
        <div className="container">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">Everything You Get</h2>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature) => (
                <div key={feature.title} className="bg-card p-6 rounded-xl shadow-sm border border-border hover:border-accent/50 transition-colors">
                  <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-accent" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-20 bg-surface">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">Compare Your Options</h2>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-4 px-4 font-medium">Feature</th>
                    <th className="text-center py-4 px-4">
                      <div className="font-medium">Single Swing</div>
                      <div className="text-accent font-bold">$37</div>
                    </th>
                    <th className="text-center py-4 px-4">
                      <div className="font-medium">Complete Review</div>
                      <div className="text-accent font-bold">$97</div>
                    </th>
                    <th className="text-center py-4 px-4 bg-accent/10 rounded-t-lg">
                      <div className="font-bold text-accent">Inner Circle</div>
                      <div className="text-accent font-bold">$297/mo</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonData.map((row, i) => (
                    <tr key={row.feature} className="border-b border-border">
                      <td className="py-4 px-4 font-medium">{row.feature}</td>
                      <td className="text-center py-4 px-4 text-muted-foreground">
                        {typeof row.single === 'boolean' ? (
                          row.single ? <Check className="w-5 h-5 text-success mx-auto" /> : <X className="w-5 h-5 text-muted-foreground/50 mx-auto" />
                        ) : row.single}
                      </td>
                      <td className="text-center py-4 px-4 text-muted-foreground">
                        {typeof row.complete === 'boolean' ? (
                          row.complete ? <Check className="w-5 h-5 text-success mx-auto" /> : <X className="w-5 h-5 text-muted-foreground/50 mx-auto" />
                        ) : row.complete}
                      </td>
                      <td className={`text-center py-4 px-4 bg-accent/10 font-semibold ${i === comparisonData.length - 1 ? 'rounded-b-lg' : ''}`}>
                        {typeof row.inner === 'boolean' ? (
                          row.inner ? <Check className="w-5 h-5 text-accent mx-auto" /> : <X className="w-5 h-5 text-muted-foreground/50 mx-auto" />
                        ) : <span className="text-accent">{row.inner}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Who It's For */}
      <section className="py-20 bg-background">
        <div className="container">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold mb-8">Inner Circle Is For You If...</h2>
            
            <div className="space-y-4 mb-10">
              {whoIsThisFor.map((item) => (
                <div key={item} className="flex items-start gap-3 bg-card p-4 rounded-lg">
                  <Check className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <div className="bg-muted p-6 rounded-xl">
              <h3 className="font-semibold text-lg mb-2">It's NOT for you if...</h3>
              <p className="text-muted-foreground">
                You're looking for a quick fix or magic drill. 
                The Inner Circle is for players who commit to the process.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-surface">
        <div className="container">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">What Members Say</h2>
            
            <div className="grid md:grid-cols-3 gap-6">
              {testimonials.map((testimonial) => (
                <div key={testimonial.name} className="bg-card p-6 rounded-xl shadow-sm">
                  <p className="text-lg mb-4 italic">"{testimonial.quote}"</p>
                  <div>
                    <div className="font-semibold">{testimonial.name}</div>
                    <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-background">
        <div className="container">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">Questions?</h2>
            
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
      <section id="join" className="py-20 bg-primary text-primary-foreground">
        <div className="container">
          <div className="max-w-xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Join?</h2>
            <p className="text-lg text-primary-foreground/80 mb-8">
              Get full access to Coach Rick's complete training system.
            </p>
            
            <div className="bg-primary-foreground/10 p-8 rounded-2xl backdrop-blur">
              <div className="flex items-baseline justify-center gap-1 mb-6">
                <span className="text-5xl font-bold text-accent">$297</span>
                <span className="text-xl text-primary-foreground/70">/month</span>
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
                  onClick={handleCheckout}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>Join Inner Circle — $297/month</>
                  )}
                </Button>
                <p className="text-xs text-primary-foreground/60">
                  Calls held every Monday at 7pm CST unless otherwise notified
                </p>
              </div>

              <div className="flex items-center gap-3 justify-center p-4 bg-background/10 rounded-lg">
                <Shield className="w-6 h-6 text-success" />
                <p className="text-sm text-primary-foreground/80">
                  30-day money-back guarantee. If it's not for you, 
                  get a full refund — no questions asked.
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
