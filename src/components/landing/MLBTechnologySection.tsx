import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Activity, Brain, BarChart3, Dna, ChevronDown } from 'lucide-react';

interface ToolCardProps {
  name: string;
  description: string;
}

function ToolCard({ name, description }: ToolCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-start gap-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-md transition-shadow">
      <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
        <div className="w-8 h-8 rounded bg-gray-200" />
      </div>
      <div>
        <h4 className="font-semibold text-[#1E3A8A] text-sm">{name}</h4>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
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
      {/* Header */}
      <div className="bg-[#1E3A8A] text-white px-4 py-3 rounded-t-lg flex items-center gap-2">
        {icon}
        <span className="font-bold text-sm uppercase tracking-wide">{title}</span>
      </div>
      
      {/* Tools */}
      <div className="bg-gray-50 rounded-b-lg p-3 flex-1 space-y-3">
        {tools.map((tool, i) => (
          <ToolCard key={i} {...tool} />
        ))}
      </div>
      
      {/* Down Arrow */}
      <div className="flex justify-center py-2">
        <ChevronDown className="w-6 h-6 text-gray-400" />
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
        { name: "HitTrax", description: "Ball flight tracking" }
      ]
    },
    {
      title: "Brain & Vision",
      icon: <Brain className="w-5 h-5" />,
      tools: [
        { name: "S2 Cognition", description: "MLB evaluation system" },
        { name: "Timing & Pattern", description: "Recognition testing" }
      ]
    },
    {
      title: "Data & Metrics",
      icon: <BarChart3 className="w-5 h-5" />,
      tools: [
        { name: "Rapsodo", description: "Pitch tracking & ball data" },
        { name: "Diamond Kinetics", description: "Swing metrics & analytics" },
        { name: "Uplift Performance", description: "Progress tracking" }
      ]
    }
  ];

  return (
    <section className="py-20 bg-background">
      <div className="container">
        <h2 className="text-3xl md:text-4xl font-black text-center mb-4 uppercase text-[#1E3A8A]">
          Why Coach Rick?
        </h2>
        <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
          He helped build the technology. Now he uses it to analyze your swing.
        </p>

        {/* Technology Columns */}
        <div className="max-w-5xl mx-auto mb-6">
          <div className="grid md:grid-cols-3 gap-6">
            {columns.map((column, i) => (
              <TechColumn key={i} {...column} />
            ))}
          </div>
        </div>

        {/* Converging Arrows - Visual connector */}
        <div className="hidden md:flex justify-center items-center mb-6">
          <div className="flex items-end gap-4">
            <div className="w-24 h-8 border-r-2 border-b-2 border-gray-300 rounded-br-lg" />
            <div className="w-px h-8 border-l-2 border-gray-300" />
            <div className="w-24 h-8 border-l-2 border-b-2 border-gray-300 rounded-bl-lg" />
          </div>
        </div>
        <div className="flex justify-center mb-6">
          <ChevronDown className="w-8 h-8 text-[#DC2626] animate-bounce" />
        </div>

        {/* Synthesis Card */}
        <div className="max-w-4xl mx-auto mb-10">
          <div className="bg-[#DC2626] text-white rounded-lg p-6 border-2 border-[#1E3A8A]">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <Dna className="w-8 h-8" />
              </div>
              <div className="text-center md:text-left flex-1">
                <h3 className="font-black text-xl uppercase tracking-wide mb-2">
                  Rick's 4B Analysis Engine
                </h3>
                <p className="text-white/90 text-sm md:text-base">
                  Synthesizes all data streams → Identifies your #1 problem → Prescribes the exact drill to fix
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Used by MLB Badge */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex items-center gap-2 bg-[#1E3A8A] text-white px-6 py-3 rounded-full text-sm font-bold uppercase tracking-wide">
            <span className="text-lg">⚾</span>
            USED BY MLB TEAMS
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Button asChild variant="outline" size="lg" className="border-[#1E3A8A] text-[#1E3A8A] hover:bg-[#1E3A8A] hover:text-white font-bold">
            <Link to="/about">LEARN MORE ABOUT RICK →</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
