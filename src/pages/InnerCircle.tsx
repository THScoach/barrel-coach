import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Check, MessageCircle, Video, Users, Brain, Shield, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const features = [
  {
    icon: Video,
    title: '2 Personal Video Reviews Per Month',
    description: 'Send your swings. Rick records a personal breakdown video just for you.',
  },
  {
    icon: Users,
    title: 'Weekly Group Coaching Calls',
    description: 'Live Q&A with Rick. Ask anything. Get real answers.',
  },
  {
    icon: MessageCircle,
    title: 'Direct Chat Access to Rick',
    description: 'Text Rick questions anytime. He responds within 24 hours.',
  },
  {
    icon: Check,
    title: 'Unlimited Swing Analysis',
    description: 'Upload as many swings as you want. Full 4B breakdown every time.',
  },
  {
    icon: Brain,
    title: 'Priority Scheduling for In-Person',
    description: 'Jump the line when you want to train with Rick in person.',
  },
];

const whoIsThisFor = [
  'Serious players who want to get recruited',
  'Players preparing for showcases or tryouts',
  'Parents who want their kid coached by the best',
  'Anyone who wants ongoing access to an AAA hitting coach',
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
    <div className="min-h-screen flex flex-col">
      <Header />
      
      {/* Hero Section */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-lg text-primary-foreground/70 mb-4">
              WANT PERSONAL COACHING FROM AN AAA HITTING COACH?
            </p>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              RICK'S <span className="text-accent">INNER CIRCLE</span>
            </h1>
            <div className="text-5xl md:text-6xl font-bold text-accent mb-2">
              $297<span className="text-2xl text-primary-foreground/70">/month</span>
            </div>
          </div>
        </div>
      </section>

      {/* What You Get */}
      <section className="py-16 bg-background">
        <div className="container">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold mb-8">WHAT YOU GET:</h2>
            
            <div className="space-y-6">
              {features.map((feature) => (
                <div key={feature.title} className="flex gap-4 bg-card p-6 rounded-xl shadow-sm">
                  <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <feature.icon className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-1">{feature.title}</h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Who Is This For */}
      <section className="py-16 bg-surface">
        <div className="container">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold mb-8">WHO IS THIS FOR?</h2>
            
            <div className="grid sm:grid-cols-2 gap-4">
              {whoIsThisFor.map((item) => (
                <div key={item} className="flex items-start gap-3 bg-card p-4 rounded-lg">
                  <Check className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Quote */}
      <section className="py-16 bg-background">
        <div className="container">
          <div className="max-w-3xl mx-auto">
            <blockquote className="bg-primary text-primary-foreground p-8 rounded-xl">
              <p className="text-lg md:text-xl italic mb-4">
                "I use the same drills with my AAA players that I use with Inner Circle members. 
                The swing is the swing — it works at every level."
              </p>
              <footer className="text-primary-foreground/70">
                — Rick Strickland, AAA Hitting Coach, Baltimore Orioles
              </footer>
            </blockquote>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-surface">
        <div className="container">
          <div className="max-w-xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-warning/10 text-warning px-4 py-2 rounded-full mb-6 font-semibold">
              ⚠️ Only 12 spots available
            </div>
            
            <div className="space-y-4 mb-8">
              <Input
                type="email"
                placeholder="Enter your email to apply"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="text-center text-lg py-6"
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
                  'APPLY FOR INNER CIRCLE →'
                )}
              </Button>
            </div>

            {/* Guarantee */}
            <div className="flex items-center gap-3 justify-center p-4 bg-card rounded-lg">
              <Shield className="w-8 h-8 text-success" />
              <div className="text-left">
                <div className="font-semibold">GUARANTEE</div>
                <p className="text-sm text-muted-foreground">
                  Add 5+ mph to your exit velocity in 90 days or get your money back.
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
