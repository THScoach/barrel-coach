import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Check, Clock, MessageCircle, FileText, Brain, MapPin } from 'lucide-react';

const features = [
  {
    icon: Clock,
    title: '90 Minutes of Hands-On Coaching',
    description: 'Rick will video your swing, identify what\'s wrong, and fix it on the spot. You\'ll see improvement before you leave.',
  },
  {
    icon: FileText,
    title: 'Your Personal Drill Program',
    description: 'Walk out with a custom 30-day plan — the exact drills for YOUR problems. Video demonstrations included.',
  },
  {
    icon: MessageCircle,
    title: '30 Days of Text Access to Rick',
    description: 'Text Rick anytime for the next 30 days. Send swing videos. Ask questions. Stay on track.',
  },
  {
    icon: Check,
    title: 'Your Written Report',
    description: 'Full 4B breakdown with scores, priorities, and prescriptions.',
  },
];

export default function Assessment() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      {/* Hero Section */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-lg text-accent font-semibold mb-4">
              TRAIN WITH RICK BEFORE HE LEAVES FOR SPRING TRAINING
            </p>
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              2-HOUR IN-PERSON ASSESSMENT
            </h1>
            <div className="flex items-center justify-center gap-4 mb-4">
              <span className="text-2xl text-primary-foreground/50 line-through">$399</span>
              <span className="text-5xl md:text-6xl font-bold text-accent">$299</span>
            </div>
            <div className="inline-flex items-center gap-2 bg-accent/20 text-accent px-4 py-2 rounded-full font-semibold">
              ⏰ Founders Pricing Ends January 31
            </div>
          </div>
        </div>
      </section>

      {/* Urgency Message */}
      <section className="py-8 bg-accent text-accent-foreground">
        <div className="container text-center">
          <p className="text-lg font-medium">
            Rick is reporting to Orioles spring training in February. 
            <span className="font-bold"> This is your last chance to train with him in person.</span>
          </p>
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

      {/* Add-On */}
      <section className="py-16 bg-surface">
        <div className="container">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold mb-6">OPTIONAL ADD-ON:</h2>
            
            <div className="bg-card p-6 rounded-xl shadow-sm flex gap-4">
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                <Brain className="w-6 h-6 text-accent" />
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="font-semibold text-lg">S2 Cognition Brain Test</h3>
                  <span className="bg-accent text-accent-foreground px-2 py-1 rounded text-sm font-bold">+$150</span>
                </div>
                <p className="text-muted-foreground">
                  The same test MLB teams use to evaluate players. See how your brain processes pitches.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-background">
        <div className="container">
          <div className="max-w-xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-warning/10 text-warning px-4 py-2 rounded-full mb-6 font-semibold">
              ⚠️ Only 8 spots available
            </div>
            
            <Button variant="hero" size="xl" className="w-full mb-8">
              BOOK YOUR SPOT — $299 →
            </Button>

            {/* Location */}
            <div className="flex items-center gap-3 justify-center p-4 bg-surface rounded-lg">
              <MapPin className="w-6 h-6 text-accent" />
              <div className="text-left">
                <div className="font-semibold">LOCATION</div>
                <p className="text-sm text-muted-foreground">
                  Contact for facility address
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
