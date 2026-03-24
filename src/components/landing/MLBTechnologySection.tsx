import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Activity, Brain, BarChart3, Dna, ChevronDown } from 'lucide-react';
import coachRickTee from '@/assets/coach-rick-tee.jpeg';

interface ToolCardProps {
  name: string;
  description: string;
}

function ToolCard({ name, description }: ToolCardProps) {
  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-3 flex items-start gap-3 hover:border-slate-600 transition-colors">
      <div className="w-10 h-10 rounded-lg bg-slate-700/50 flex items-center justify-center flex-shrink-0">
        <div className="w-6 h-6 rounded bg-slate-600/60" />
      </div>
      <div>
        <h4 className="font-semibold text-white text-sm">{name}</h4>
        <p className="text-xs text-slate-400 mt-0.5">{description}</p>
      </div>
    </div>
  );
}

interface TechColumnProps {
  title: string;
  icon: React.ReactNode;
  tools: ToolCardProps[];
}

function TechColumn({ title, icon, tools }: TechColumnProps) {
  return (
    <div className="flex flex-col">
      <div className="bg-red-600 text-white px-4 py-3 rounded-t-lg flex items-center gap-2">
        {icon}
        <span className="font-bold text-sm uppercase tracking-wide">{title}</span>
      </div>
      <div className="bg-slate-900 border border-slate-800 border-t-0 rounded-b-lg p-3 flex-1 space-y-3">
        {tools.map((tool, i) => (
          <ToolCard key={i} {...tool} />
        ))}
      </div>
      <div className="flex justify-center py-2">
        <ChevronDown className="w-6 h-6 text-slate-600" />
      </div>
    </div>
  );
}

export function MLBTechnologySection() {
  const columns: TechColumnProps[] = [
    {
      title: "Biomechanics",
      icon: <Activity className="w-5 h-5" />,
      tools: [
        { name: "3D Motion Capture", description: "Full-body kinematics" },
        { name: "Blast Motion", description: "Bat sensor technology" },
        { name: "HitTrax", description: "Ball flight tracking" },
      ],
    },
    {
      title: "Brain & Vision",
      icon: <Brain className="w-5 h-5" />,
      tools: [
        { name: "S2 Cognition", description: "MLB evaluation system" },
        { name: "Timing & Pattern", description: "Recognition testing" },
      ],
    },
    {
      title: "Data & Metrics",
      icon: <BarChart3 className="w-5 h-5" />,
      tools: [
        { name: "Rapsodo", description: "Pitch tracking & ball data" },
        { name: "Diamond Kinetics", description: "Swing metrics & analytics" },
        { name: "Uplift Performance", description: "Progress tracking" },
      ],
    },
  ];

  return (
    <section className="py-20 bg-slate-950">
      <div className="max-w-5xl mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-black text-center mb-4">
          Why{" "}
          <span className="bg-gradient-to-r from-red-500 to-red-400 bg-clip-text text-transparent">
            Coach Rick?
          </span>
        </h2>
        <p className="text-center text-slate-400 mb-12 max-w-2xl mx-auto">
          He helped build the technology MLB teams use. Now he uses it to analyze your swing.
        </p>

        {/* Technology Columns */}
        <div className="grid md:grid-cols-3 gap-6 mb-6">
          {columns.map((column, i) => (
            <TechColumn key={i} {...column} />
          ))}
        </div>

        {/* Converging Arrows */}
        <div className="hidden md:flex justify-center items-center mb-6">
          <div className="flex items-end gap-4">
            <div className="w-24 h-8 border-r-2 border-b-2 border-slate-700 rounded-br-lg" />
            <div className="w-px h-8 border-l-2 border-slate-700" />
            <div className="w-24 h-8 border-l-2 border-b-2 border-slate-700 rounded-bl-lg" />
          </div>
        </div>
        <div className="flex justify-center mb-6">
          <ChevronDown className="w-8 h-8 text-red-500 animate-bounce" />
        </div>

        {/* Synthesis Card */}
        <div className="max-w-4xl mx-auto mb-10">
          <div className="bg-red-600 text-white rounded-xl p-6 border border-red-500/50 shadow-lg shadow-red-600/10">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/20 flex-shrink-0">
                <img src={coachRickTee} alt="Coach Rick" className="w-full h-full object-cover" />
              </div>
              <div className="text-center md:text-left flex-1">
                <h3 className="font-black text-xl uppercase tracking-wide mb-2">
                  Rick's 4B Analysis Engine
                </h3>
                <p className="text-white/90 text-sm md:text-base">
                  Synthesizes all data streams → Identifies your #1 constraint → Prescribes the exact drill to fix it
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* MLB Badge */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex items-center gap-2 bg-slate-800/80 border border-slate-700/50 text-white px-6 py-3 rounded-full text-sm font-bold uppercase tracking-wide">
            <span className="text-lg">⚾</span>
            Used by MLB Organizations
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Button asChild variant="outline" size="lg" className="border-slate-600 hover:bg-slate-800 text-white font-bold">
            <Link to="/about">Learn More About Rick →</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
