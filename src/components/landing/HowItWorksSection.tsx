import { Link } from 'react-router-dom';
import { Smartphone, Dna, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';

const steps = [
  {
    number: '1.',
    title: 'CAPTURE',
    icon: Smartphone,
    bullets: ['Record 5 swings', 'Front or side angle', 'Phone camera', 'Takes 2 minutes'],
    timing: '2 min',
    timingLabel: 'gray',
    subtext: 'Like taking a video',
  },
  {
    number: '2.',
    title: 'DIAGNOSE',
    icon: Dna,
    bullets: ['AI scans 4B System', 'Rick reviews personally', 'Identifies #1 problem', 'Medical-grade analysis'],
    timing: 'AI + Coach Rick',
    timingLabel: 'red',
    subtext: 'Medical-grade scan',
  },
  {
    number: '3.',
    title: 'PRESCRIBE',
    icon: ClipboardList,
    bullets: ['Custom drill plan', 'Video demonstrations', 'Track your progress', 'Instant delivery'],
    timing: 'Under 48 hours',
    timingLabel: 'red',
    subtext: 'Your drill prescription',
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-20 bg-surface">
      <div className="container">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 uppercase">
          How It Works
        </h2>
        <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
          Professional swing analysis in three simple steps
        </p>

        {/* Pipeline Cards */}
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-0 relative">
            {/* Connecting Lines - Desktop only */}
            <div className="hidden md:block absolute top-24 left-[33%] right-[33%] h-0.5">
              <div className="h-full border-t-2 border-dashed border-border relative">
                <div className="absolute inset-0 animate-pulse-line" />
              </div>
            </div>

            {steps.map((step, index) => (
              <div key={step.title} className="relative">
                {/* Card */}
                <div className="bg-card rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-6 mx-2 h-full flex flex-col">
                  {/* Icon */}
                  <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 rounded-full bg-[hsl(222,47%,11%)] flex items-center justify-center">
                      <step.icon className="w-8 h-8 text-white" strokeWidth={2} />
                    </div>
                  </div>

                  {/* Step Number & Title */}
                  <div className="text-center mb-4">
                    <span className="text-accent font-bold text-lg">{step.number}</span>
                    <h3 className="text-xl font-bold text-[hsl(222,47%,11%)] uppercase tracking-wide">
                      {step.title}
                    </h3>
                  </div>

                  {/* Bullets */}
                  <ul className="space-y-2 mb-6 flex-grow">
                    {step.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-2 text-sm text-foreground/80">
                        <span className="text-accent mt-0.5">•</span>
                        {bullet}
                      </li>
                    ))}
                  </ul>

                  {/* Timing Bar */}
                  <div className="mt-auto">
                    <div
                      className={`h-2 rounded-full ${
                        step.timingLabel === 'red' ? 'bg-accent' : 'bg-muted'
                      }`}
                    />
                    <p className="text-xs text-center mt-2 font-medium text-muted-foreground">
                      {step.timing}
                    </p>
                  </div>

                  {/* Subtext */}
                  <p className="text-xs text-center text-muted-foreground mt-3 italic">
                    {step.subtext}
                  </p>
                </div>

                {/* Mobile connector arrow */}
                {index < steps.length - 1 && (
                  <div className="md:hidden flex justify-center my-4">
                    <div className="w-0.5 h-8 border-l-2 border-dashed border-border" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Proprietary Badge */}
          <div className="flex justify-center mt-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[hsl(222,47%,11%)] rounded-full">
              <Dna className="w-4 h-4 text-accent" />
              <span className="text-xs font-semibold text-white uppercase tracking-wider">
                Proprietary 4B Analysis
              </span>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-10">
          <Button asChild variant="hero" size="lg">
            <Link to="/analyze">GET MY SWING SCORE — $37</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
