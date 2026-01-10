import { useEffect, useState } from 'react';
import { ArrowRight, Award, Clock, Star } from 'lucide-react';

interface GaugeProps {
  value: number;
  label: string;
  color: string;
  isWeakest?: boolean;
}

const Gauge = ({ value, label, color, isWeakest }: GaugeProps) => {
  const [animatedValue, setAnimatedValue] = useState(0);
  const circumference = 2 * Math.PI * 40;
  const dashOffset = circumference - (animatedValue / 80) * circumference;

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedValue(value), 300);
    return () => clearTimeout(timer);
  }, [value]);

  return (
    <div className="text-center">
      <div className="relative w-24 h-24 mx-auto mb-2">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="hsl(var(--gray-400) / 0.2)"
            strokeWidth="8"
          />
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke={`hsl(var(--${color}))`}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-navy-900">{animatedValue}</span>
        </div>
      </div>
      <span className={`text-xs uppercase tracking-wider ${isWeakest ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
        {label}
        {isWeakest && ' ⚠️'}
      </span>
    </div>
  );
};

export function HeroScoreCard() {
  const [compositeScore, setCompositeScore] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setCompositeScore(62), 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="relative">
      {/* Floating Badges */}
      <div className="absolute -top-4 -right-4 bg-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 animate-float z-10">
        <Award className="w-4 h-4 text-accent" />
        <span className="text-xs font-semibold text-navy-900">MLB Coach Analyzed</span>
      </div>
      
      <div className="absolute -left-8 top-1/2 -translate-y-1/2 bg-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 animate-float-delayed z-10 hidden lg:flex">
        <Clock className="w-4 h-4 text-body-blue" />
        <span className="text-xs font-semibold text-navy-900">60 Second Results</span>
      </div>
      
      <div className="absolute -bottom-4 -right-8 bg-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 animate-float-slow z-10 hidden lg:flex">
        <Star className="w-4 h-4 text-bat-orange" />
        <span className="text-xs font-semibold text-navy-900">Drill Prescription</span>
      </div>

      {/* Score Card */}
      <div className="bg-white rounded-3xl p-8 shadow-2xl w-full max-w-md animate-float-main">
        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            4B Score Card™
          </p>
          <div className="text-7xl font-bold text-navy-900 leading-none">
            {compositeScore}
          </div>
          <p className="text-bat-orange font-semibold mt-1">Plus Grade</p>
        </div>

        {/* Gauges Grid */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          <Gauge value={58} label="Brain" color="brain-purple" />
          <Gauge value={65} label="Body" color="body-blue" />
          <Gauge value={52} label="Bat" color="bat-orange" isWeakest />
          <Gauge value={68} label="Ball" color="ball-red" />
        </div>

        {/* Footer */}
        <div className="pt-6 border-t border-border text-center">
          <a href="#pricing" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-accent transition-colors">
            Get Your Score Card <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
