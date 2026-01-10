import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowDown, Shield, Clock, Award } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { HeroScoreCard } from '@/components/landing/HeroScoreCard';
import { SocialProofSection } from '@/components/landing/SocialProofSection';
import { Interactive4BDiamond } from '@/components/landing/Interactive4BDiamond';
import { HowItWorksSteps } from '@/components/landing/HowItWorksSteps';
import { PricingSection } from '@/components/landing/PricingSection';
import { TestimonialsSection } from '@/components/landing/TestimonialsSection';

export default function Index() {
  useEffect(() => {
    document.title = 'Baseball Swing Analysis by MLB Hitting Coach | Catching Barrels';
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      {/* Hero Section - Split Screen */}
      <section className="relative bg-primary text-primary-foreground min-h-screen flex items-center py-32 overflow-hidden">
        {/* Background Video */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src="/videos/hero-swing.mp4" type="video/mp4" />
        </video>
        
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-primary/75" />
        
        <div className="container relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left - Content */}
            <div>
              <div className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-accent bg-accent/10 px-4 py-2 rounded-full mb-6">
                <Award className="w-4 h-4" />
                MLB Hitting Coach Analyzed
              </div>
              
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
                <span className="text-white">UNLOCK YOUR</span>
                <br />
                <span className="text-accent">SWING DNA</span>
              </h1>
              
              <p className="text-xl text-white/80 mb-6 max-w-lg">
                Get your swing analyzed by an MLB Hitting Coach. 
                Find your #1 problem. Get the drill to fix it. Results in 60 seconds.
              </p>

              <div className="flex flex-wrap gap-6 mb-8 text-sm text-white/60">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-accent" />
                  30-Day Guarantee
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-accent" />
                  60s Results
                </div>
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-accent" />
                  400+ Commits
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <Button asChild variant="hero" size="xl">
                  <Link to="/analyze">GET MY SWING SCORE — $37</Link>
                </Button>
                <Button variant="ghost" size="xl" className="text-white/70 hover:text-white">
                  <a href="#pricing">See Pricing</a>
                  <ArrowDown className="ml-2 w-5 h-5" />
                </Button>
              </div>

              <p className="text-sm text-accent font-medium">
                ⚡ Video analysis + drill plan delivered in under 60 seconds
              </p>
            </div>

            {/* Right - Score Card */}
            <div className="hidden lg:flex justify-center">
              <HeroScoreCard />
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <SocialProofSection />

      {/* Interactive 4B Diamond */}
      <Interactive4BDiamond />

      {/* How It Works */}
      <HowItWorksSteps />

      {/* Pricing */}
      <PricingSection />

      {/* Testimonials */}
      <TestimonialsSection />

      {/* Final CTA */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to unlock your swing potential?
          </h2>
          <p className="text-lg text-white/80 mb-6">
            Upload your swing. Get your score. Know exactly what to fix at your next practice.
          </p>
          <Button asChild variant="hero" size="xl">
            <Link to="/analyze">GET MY SWING SCORE — $37</Link>
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
