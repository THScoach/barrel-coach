import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowDown, Video, Brain, FileText, Check, ChevronDown } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import rickCoaching1 from '@/assets/rick-coaching-1.jpg';
import rickBenintendi from '@/assets/rick-benintendi.jpg';
import fourBSystemGraphic from '@/assets/4b-system-graphic.png';

// MLB Team logos placeholder - would be replaced with actual images
const mlbPlayers = [
  { name: 'Pete Crow-Armstrong', team: 'Cubs' },
  { name: 'Andrew Benintendi', team: 'Multiple Teams' },
  { name: 'Cedric Mullins', team: 'Orioles' },
  { name: 'Devin Williams', team: 'Brewers' },
];

const faqItems = [
  {
    question: "How do I record my swing?",
    answer: "Side angle, 10-15 feet away, hip height, landscape mode. Full body visible. One swing per video."
  },
  {
    question: "What equipment do I need?",
    answer: "Just your phone. Any iPhone or Android from the last 5 years works. No sensors required."
  },
  {
    question: "How long until I get my results?",
    answer: "Usually 30-60 seconds. Your PDF report is emailed immediately."
  },
  {
    question: "What's the difference between Single Swing and Complete Review?",
    answer: "Single Swing analyzes 1 video and finds your #1 problem. Complete Review analyzes 5 swings, shows your consistency, compares you to your age group, and gives you a 30-day plan."
  },
  {
    question: "Who is Rick Strickland?",
    answer: "Rick is the MLB Hitting Coach for the Baltimore Orioles. He's trained 400+ college commits, 78+ pro players, and 3 MLB Award Winners including Andrew Benintendi and Devin Williams."
  },
  {
    question: "Can I get a refund?",
    answer: "If you're not satisfied, email us within 24 hours of purchase and we'll refund you. No questions asked."
  }
];

export default function Index() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      {/* Hero Section */}
      <section className="relative bg-primary text-primary-foreground py-20 lg:py-32 overflow-hidden">
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
        
        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-primary/80" />
        
        <div className="container relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              <span className="block text-white">UNLOCK YOUR</span>
              <span className="text-accent">SWING DNA</span>
            </h1>
            <p className="text-lg md:text-xl text-white/80 mb-8 max-w-2xl mx-auto">
              Get your swing analyzed by an MLB Hitting Coach. 
              Find your #1 problem. Get the drill to fix it.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Button asChild variant="hero" size="xl">
                <Link to="/analyze">GET YOUR SWING ANALYZED — $37</Link>
              </Button>
              <Button variant="ghost" size="xl" className="text-white/70 hover:text-white">
                See How It Works <ArrowDown className="ml-2 w-5 h-5" />
              </Button>
            </div>

            <div className="pt-8 border-t border-white/10">
              <p className="text-sm text-white/60 mb-4">
                Trusted by players who made it to:
              </p>
              <div className="flex flex-wrap justify-center gap-8 items-center">
                {mlbPlayers.map((player) => (
                  <div key={player.name} className="text-center">
                    <div className="text-sm font-medium text-white">{player.name}</div>
                    <div className="text-xs text-white/50">{player.team}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 bg-surface">
        <div className="container">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            HOW IT WORKS
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto mb-12">
            {[
              { icon: Video, step: '1', title: 'UPLOAD', description: 'Record your swing and upload it' },
              { icon: Brain, step: '2', title: 'ANALYZE', description: 'We score your Brain, Body, Bat & Ball' },
              { icon: FileText, step: '3', title: 'FIX', description: 'Get your personalized drill plan' },
            ].map((item) => (
              <div key={item.step} className="text-center p-6 bg-card rounded-xl shadow-card">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent/10 flex items-center justify-center">
                  <item.icon className="w-8 h-8 text-accent" />
                </div>
                <div className="text-sm text-accent font-semibold mb-2">STEP {item.step}</div>
                <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Button asChild variant="hero" size="lg">
              <Link to="/analyze">GET STARTED — $37</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* The 4B System Section */}
      <section className="py-20 bg-background">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
              THE 4B SYSTEM™
            </h2>
            <p className="text-center text-muted-foreground mb-8">
              We analyze 4 components of your swing to find and fix your weakest link
            </p>

            <div className="bg-card rounded-xl p-4 md:p-8 shadow-card">
              <img 
                src={fourBSystemGraphic} 
                alt="The 4B Hitting System - Brain (Timing, Sync, Pattern Recognition), Body (Ground-Up Sequencing, Force Creation), Bat (Barrel Control, Transfer Efficiency), Ball (Contact Quality, Exit Velocity)" 
                className="w-full h-auto"
              />
            </div>

            <p className="text-center mt-8 text-lg font-medium">
              Most coaches guess. <span className="text-accent">We measure.</span> Then we fix the weakest link.
            </p>
          </div>
        </div>
      </section>

      {/* Meet Your Coach Section */}
      <section className="py-20 bg-surface">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-[240px_1fr] gap-8 items-start">
              {/* Rick coaching photo */}
              <div className="rounded-xl overflow-hidden aspect-square">
                <img 
                  src={rickCoaching1} 
                  alt="Rick Strickland coaching" 
                  className="w-full h-full object-cover"
                />
              </div>

              <div>
                <p className="text-accent font-semibold mb-2">MEET YOUR COACH</p>
                <h2 className="text-3xl font-bold mb-1">Rick Strickland</h2>
                <p className="text-muted-foreground mb-4">
                  The Swing Rehab Coach — MLB Hitting Coach, Baltimore Orioles
                </p>

                <p className="text-foreground/80 mb-6">
                  Rick doesn't guess. He diagnoses your swing like a doctor diagnoses an injury — 
                  find the problem, prescribe the fix, track your progress.
                </p>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  {[
                    '400+ college commits',
                    '78+ professional players',
                    '3 MLB Award Winners',
                    'Technology Pioneer',
                  ].map((stat) => (
                    <div key={stat} className="flex items-center gap-2">
                      <Check className="w-5 h-5 text-accent" />
                      <span className="text-sm">{stat}</span>
                    </div>
                  ))}
                </div>

                <Button asChild variant="accent-outline" size="lg">
                  <Link to="/about">LEARN MORE ABOUT RICK →</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="py-20 bg-background">
        <div className="container">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            PLAYERS RICK HAS TRAINED
          </h2>

          {/* Featured player */}
          <div className="max-w-3xl mx-auto mb-12">
            <div className="rounded-xl overflow-hidden aspect-video">
              <img 
                src={rickBenintendi} 
                alt="Rick Strickland with Andrew Benintendi" 
                className="w-full h-full object-cover"
              />
            </div>
            <p className="text-center mt-4 text-muted-foreground">
              Rick with Andrew Benintendi — Gold Glove Winner, World Series Champion
            </p>
          </div>

          {/* Player grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {[
              { name: 'Pete Crow-Armstrong', team: 'Cubs' },
              { name: 'Cedric Mullins', team: 'Orioles' },
              { name: 'Devin Williams', team: 'NL ROY 2020' },
              { name: 'Carson Kelly', team: 'All-Star' },
            ].map((player) => (
              <div key={player.name} className="bg-card p-4 rounded-xl text-center shadow-sm">
                <div className="w-16 h-16 mx-auto mb-3 bg-muted rounded-full" />
                <div className="font-semibold text-sm">{player.name}</div>
                <div className="text-xs text-muted-foreground">{player.team}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 bg-surface">
        <div className="container">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            CHOOSE YOUR ANALYSIS
          </h2>

          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto mb-12">
            {/* Single Swing */}
            <div className="bg-card rounded-xl p-8 shadow-card">
              <h3 className="text-xl font-bold mb-2">SINGLE SWING SCORE</h3>
              <div className="text-4xl font-bold mb-6">$37</div>
              
              <ul className="space-y-3 mb-8">
                {[
                  '1 swing analyzed',
                  'Your #1 problem identified',
                  '1 drill to fix it',
                  'PDF report',
                ].map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-accent" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Button asChild variant="accent" className="w-full">
                <Link to="/analyze">GET STARTED</Link>
              </Button>
            </div>

            {/* Complete Review */}
            <div className="bg-card rounded-xl p-8 shadow-card border-2 border-accent relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-accent-foreground px-3 py-1 rounded-full text-xs font-bold">
                ⭐ MOST POPULAR
              </div>
              
              <h3 className="text-xl font-bold mb-2">COMPLETE REVIEW</h3>
              <div className="text-4xl font-bold mb-6">$97</div>
              
              <ul className="space-y-3 mb-8">
                {[
                  '5 swings analyzed',
                  'Consistency score',
                  'Age group comparison',
                  '30-day drill plan',
                  'PDF report',
                ].map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-accent" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Button asChild variant="hero" className="w-full">
                <Link to="/analyze">GET STARTED</Link>
              </Button>
            </div>
          </div>

          <div className="text-center pt-8 border-t border-border max-w-xl mx-auto">
            <p className="text-muted-foreground mb-4">Want personal coaching from Rick?</p>
            <Button asChild variant="accent-outline" size="lg">
              <Link to="/inner-circle">JOIN RICK'S INNER CIRCLE — $297/month →</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-background">
        <div className="container">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            FREQUENTLY ASKED QUESTIONS
          </h2>

          <div className="max-w-2xl mx-auto">
            <Accordion type="single" collapsible className="space-y-2">
              {faqItems.map((item, index) => (
                <AccordionItem 
                  key={index} 
                  value={`item-${index}`}
                  className="bg-card rounded-lg px-6 border-none shadow-sm"
                >
                  <AccordionTrigger className="text-left font-semibold hover:no-underline">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to unlock your swing potential?
          </h2>
          <Button asChild variant="hero" size="xl">
            <Link to="/analyze">GET YOUR SWING ANALYZED — $37</Link>
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
