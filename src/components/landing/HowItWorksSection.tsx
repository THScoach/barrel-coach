import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Smartphone, Dna, ClipboardList, Clock } from 'lucide-react';

interface StepCardProps {
  stepNumber: string;
  title: string;
  icon: React.ReactNode;
  bullets: string[];
  timing: string;
  timingLabel: string;
  subtext: string;
  isActive?: boolean;
}

function StepCard({ stepNumber, title, icon, bullets, timing, timingLabel, subtext }: StepCardProps) {
  return (
    <div className="relative bg-white rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-6 flex flex-col items-center text-center group hover:shadow-lg transition-shadow">
      {/* Icon */}
      <div className="w-16 h-16 rounded-full bg-[#1E3A8A]/10 flex items-center justify-center mb-4">
        {icon}
      </div>
      
      {/* Step number and title */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[#DC2626] font-black text-xl">{stepNumber}</span>
        <span className="text-[#1E3A8A] font-bold text-lg tracking-wide uppercase">{title}</span>
      </div>
      
      {/* Bullets */}
      <ul className="text-sm text-muted-foreground space-y-2 mb-4 text-left w-full">
        {bullets.map((bullet, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1E3A8A]" />
            {bullet}
          </li>
        ))}
      </ul>
      
      {/* Timing bar */}
      <div className="w-full bg-gray-100 rounded-full h-2 mb-2 overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-500 ${
            timingLabel === '2 min' ? 'w-1/4 bg-gray-400' : 'w-full bg-[#DC2626]'
          }`}
        />
      </div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="w-3 h-3" />
        <span>{timing}</span>
      </div>
      
      {/* Subtext */}
      <p className="text-xs text-muted-foreground mt-3 italic">{subtext}</p>
    </div>
  );
}

function ConnectorLine() {
  return (
    <div className="hidden md:flex items-center justify-center px-2">
      <div className="relative w-12 h-0.5">
        <div className="absolute inset-0 border-t-2 border-dashed border-gray-300" />
        <div className="absolute top-1/2 left-0 w-2 h-2 -translate-y-1/2 rounded-full bg-[#DC2626] animate-pulse" />
      </div>
    </div>
  );
}

export function HowItWorksSection() {
  const steps: Omit<StepCardProps, 'isActive'>[] = [
    {
      stepNumber: "1.",
      title: "CAPTURE",
      icon: <Smartphone className="w-8 h-8 text-[#1E3A8A]" />,
      bullets: ["Record 5 swings", "Front or side angle", "Phone camera", "Takes 2 minutes"],
      timing: "2 min",
      timingLabel: "2 min",
      subtext: "Like taking a video"
    },
    {
      stepNumber: "2.",
      title: "DIAGNOSE",
      icon: <Dna className="w-8 h-8 text-[#1E3A8A]" />,
      bullets: ["AI scans 4B System", "Rick reviews personally", "Identifies #1 problem", "Medical-grade analysis"],
      timing: "AI + Coach Rick",
      timingLabel: "analysis",
      subtext: "Medical-grade scan"
    },
    {
      stepNumber: "3.",
      title: "PRESCRIBE",
      icon: <ClipboardList className="w-8 h-8 text-[#1E3A8A]" />,
      bullets: ["Custom drill plan", "Video demonstrations", "Track your progress", "Instant delivery"],
      timing: "Under 48 hours",
      timingLabel: "delivery",
      subtext: "Your drill prescription"
    }
  ];

  return (
    <section id="how-it-works" className="py-20 bg-surface">
      <div className="container">
        <h2 className="text-3xl md:text-4xl font-black text-center mb-4 uppercase text-[#1E3A8A]">
          How It Works
        </h2>
        <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
          Professional swing analysis in three simple steps
        </p>

        {/* Medical Diagnostic Pipeline */}
        <div className="max-w-5xl mx-auto mb-8">
          <div className="flex flex-col md:flex-row items-stretch justify-center gap-4 md:gap-0">
            <div className="flex-1 max-w-sm">
              <StepCard {...steps[0]} />
            </div>
            <ConnectorLine />
            <div className="flex-1 max-w-sm">
              <StepCard {...steps[1]} />
            </div>
            <ConnectorLine />
            <div className="flex-1 max-w-sm">
              <StepCard {...steps[2]} />
            </div>
          </div>
        </div>

        {/* Proprietary Badge */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex items-center gap-2 bg-[#1E3A8A] text-white px-4 py-2 rounded-full text-sm font-semibold">
            <Dna className="w-4 h-4" />
            PROPRIETARY 4B ANALYSIS
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Button asChild variant="hero" size="lg">
            <Link to="/analyze">GET MY SWING SCORE — $37</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
