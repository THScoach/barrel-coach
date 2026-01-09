import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Check, MessageCircle, Video, Users, Brain, Shield } from 'lucide-react';

const features = [
  {
    icon: Video,
    title: '2 Personal Video Reviews from Rick Every Month',
    description: 'Send your swings. Rick records a personal breakdown video for you.',
  },
  {
    icon: Users,
    title: 'Weekly Group Coaching Calls',
    description: 'Live Q&A with Rick. Ask anything. Get real answers.',
  },
  {
    icon: MessageCircle,
    title: 'Direct Access to Rick via Chat',
    description: 'Text Rick questions anytime. He responds within 24 hours.',
  },
  {
    icon: Check,
    title: 'Unlimited Swing Analysis',
    description: 'Upload as many swings as you want. Full 4B breakdown every time.',
  },
  {
    icon: Brain,
    title: 'S2 Cognition Brain Testing (Add-On Available)',
    description: 'The same brain test MLB teams use to evaluate players.',
  },
];

const whoIsThisFor = [
  'Serious players who want to get recruited',
  'Players preparing for showcases or tryouts',
  'Parents who want their kid coached by the best',
  'Anyone who wants ongoing access to an AAA hitting coach',
];

export default function InnerCircle() {
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
            
            <Button variant="hero" size="xl" className="w-full mb-8">
              JOIN THE INNER CIRCLE →
            </Button>

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
