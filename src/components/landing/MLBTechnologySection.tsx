import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dna, ChevronDown } from 'lucide-react';

const columns = [
  {
    title: 'BIOMECHANICS',
    tools: [
      { name: '3D Motion Capture', description: 'Full-body kinematics' },
      { name: 'Blast Motion', description: 'Bat sensor technology' },
      { name: 'HitTrax', description: 'Ball flight tracking' },
    ],
  },
  {
    title: 'BRAIN & VISION',
    tools: [
      { name: 'S2 Cognition', description: 'MLB evaluation system' },
      { name: 'Timing & Pattern', description: 'Recognition testing' },
    ],
  },
  {
    title: 'DATA & METRICS',
    tools: [
      { name: 'Rapsodo', description: 'Pitch tracking & ball data' },
      { name: 'Diamond Kinetics', description: 'Swing metrics & analytics' },
      { name: 'Uplift Performance', description: 'Progress tracking' },
    ],
  },
];

export function MLBTechnologySection() {
  return (
    <section className="py-20 bg-background">
      <div className="container">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 uppercase">
          MLB-Level Technology
        </h2>
        <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
          Rick helped BUILD these systems. Now he uses them to analyze YOUR swing.
        </p>

        {/* Technology Grid */}
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {columns.map((column) => (
              <div key={column.title} className="flex flex-col">
                {/* Column Header */}
                <div className="bg-[hsl(222,47%,11%)] rounded-t-lg px-4 py-3">
                  <h3 className="text-white text-sm font-bold uppercase tracking-wider text-center">
                    {column.title}
                  </h3>
                </div>

                {/* Tool Cards */}
                <div className="flex flex-col gap-3 p-4 bg-surface rounded-b-lg flex-grow">
                  {column.tools.map((tool) => (
                    <div
                      key={tool.name}
                      className="bg-card rounded-lg border border-border p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
                    >
                      {/* Logo placeholder */}
                      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center mb-3 mx-auto">
                        <span className="text-xs text-muted-foreground font-medium">LOGO</span>
                      </div>
                      <h4 className="text-[hsl(222,47%,11%)] font-semibold text-center text-sm">
                        {tool.name}
                      </h4>
                      <p className="text-muted-foreground text-xs text-center mt-1">
                        {tool.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Converging Arrows */}
          <div className="flex justify-center mb-4">
            <div className="flex items-center gap-8">
              <ChevronDown className="w-6 h-6 text-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
              <ChevronDown className="w-6 h-6 text-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
              <ChevronDown className="w-6 h-6 text-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>

          {/* Synthesis Card */}
          <div className="bg-accent border-2 border-[hsl(222,47%,11%)] rounded-lg p-6 md:p-8">
            <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6">
              <div className="flex-shrink-0">
                <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
                  <Dna className="w-8 h-8 text-white" />
                </div>
              </div>
              <div className="text-center md:text-left">
                <h3 className="text-white font-bold text-lg uppercase tracking-wide mb-2">
                  Rick's 4B Analysis Engine
                </h3>
                <p className="text-white/90 text-sm">
                  Synthesizes all data streams
                  <span className="mx-2">→</span>
                  Identifies your #1 problem
                  <span className="mx-2">→</span>
                  Prescribes the exact drill to fix
                </p>
              </div>
            </div>
          </div>

          {/* MLB Badge */}
          <div className="flex justify-center mt-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-muted rounded-full">
              <span className="text-sm font-medium text-muted-foreground">
                🏟️ USED BY MLB TEAMS
              </span>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-10">
          <Button asChild variant="accent-outline" size="lg">
            <Link to="/about">LEARN MORE ABOUT RICK →</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
