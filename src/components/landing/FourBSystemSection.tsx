import { useState } from 'react';
import { Brain, Activity, Flame, Target } from 'lucide-react';

const nodes = [
  {
    id: 'brain',
    label: 'BRAIN',
    icon: Brain,
    color: 'hsl(256, 87%, 65%)', // Purple #8B5CF6
    colorClass: 'text-[#8B5CF6]',
    bgClass: 'bg-[#8B5CF6]',
    bullets: ['Timing', 'Pattern Recognition', 'Sync'],
    position: 'top',
  },
  {
    id: 'body',
    label: 'BODY',
    icon: Activity,
    color: 'hsl(217, 91%, 60%)', // Blue #3B82F6
    colorClass: 'text-[#3B82F6]',
    bgClass: 'bg-[#3B82F6]',
    bullets: ['Ground-up sequencing', 'Kinetic chain', 'Force creation'],
    position: 'left',
  },
  {
    id: 'bat',
    label: 'BAT',
    icon: Flame,
    color: 'hsl(25, 95%, 53%)', // Orange #F97316
    colorClass: 'text-[#F97316]',
    bgClass: 'bg-[#F97316]',
    bullets: ['Barrel path', 'Transfer efficiency', 'Attack angle'],
    position: 'right',
  },
  {
    id: 'ball',
    label: 'BALL',
    icon: Target,
    color: 'hsl(0, 84%, 50%)', // Red #DC2626
    colorClass: 'text-accent',
    bgClass: 'bg-accent',
    bullets: ['Exit velocity', 'Launch angle', 'Contact quality'],
    position: 'bottom',
  },
];

export function FourBSystemSection() {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [targetNode] = useState('body'); // Demo: Body is the "weakness"

  return (
    <section className="py-20 bg-background">
      <div className="container">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 uppercase">
          The 4B System™
        </h2>
        <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
          Every swing is a symphony of four interconnected systems. We measure each one.
        </p>

        {/* Circular Diagram */}
        <div className="max-w-4xl mx-auto">
          {/* Desktop Layout */}
          <div className="hidden md:block relative" style={{ height: '500px' }}>
            {/* Center Batter Silhouette */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 flex items-center justify-center">
              <div className="w-24 h-24 rounded-full bg-[hsl(222,47%,11%)] flex items-center justify-center">
                <svg viewBox="0 0 100 100" className="w-16 h-16 text-white/80">
                  <circle cx="50" cy="20" r="10" fill="currentColor" />
                  <path d="M50 30 L50 60 M50 40 L30 55 M50 40 L75 25 M50 60 L35 85 M50 60 L65 85" 
                    stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" />
                </svg>
              </div>
            </div>

            {/* Connecting Lines */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
              {/* Lines to each node */}
              <line x1="50%" y1="50%" x2="50%" y2="15%" stroke="#D1D5DB" strokeWidth="2" strokeDasharray="6 4" />
              <line x1="50%" y1="50%" x2="15%" y2="50%" stroke="#D1D5DB" strokeWidth="2" strokeDasharray="6 4" />
              <line x1="50%" y1="50%" x2="85%" y2="50%" stroke="#D1D5DB" strokeWidth="2" strokeDasharray="6 4" />
              <line x1="50%" y1="50%" x2="50%" y2="85%" stroke="#D1D5DB" strokeWidth="2" strokeDasharray="6 4" />
            </svg>

            {/* Top Node - Brain */}
            <div 
              className="absolute left-1/2 top-0 -translate-x-1/2"
              onMouseEnter={() => setHoveredNode('brain')}
              onMouseLeave={() => setHoveredNode(null)}
            >
              <NodeCard node={nodes[0]} isHovered={hoveredNode === 'brain'} isTarget={targetNode === 'brain'} />
            </div>

            {/* Left Node - Body */}
            <div 
              className="absolute left-0 top-1/2 -translate-y-1/2"
              onMouseEnter={() => setHoveredNode('body')}
              onMouseLeave={() => setHoveredNode(null)}
            >
              <NodeCard node={nodes[1]} isHovered={hoveredNode === 'body'} isTarget={targetNode === 'body'} />
            </div>

            {/* Right Node - Bat */}
            <div 
              className="absolute right-0 top-1/2 -translate-y-1/2"
              onMouseEnter={() => setHoveredNode('bat')}
              onMouseLeave={() => setHoveredNode(null)}
            >
              <NodeCard node={nodes[2]} isHovered={hoveredNode === 'bat'} isTarget={targetNode === 'bat'} />
            </div>

            {/* Bottom Node - Ball */}
            <div 
              className="absolute left-1/2 bottom-0 -translate-x-1/2"
              onMouseEnter={() => setHoveredNode('ball')}
              onMouseLeave={() => setHoveredNode(null)}
            >
              <NodeCard node={nodes[3]} isHovered={hoveredNode === 'ball'} isTarget={targetNode === 'ball'} />
            </div>
          </div>

          {/* Mobile Layout - 2x2 Grid */}
          <div className="md:hidden grid grid-cols-2 gap-4">
            {nodes.map((node) => (
              <div key={node.id} className="flex justify-center">
                <NodeCard node={node} isHovered={false} isTarget={targetNode === node.id} />
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Banner */}
        <div className="max-w-3xl mx-auto mt-12">
          <div className="bg-[hsl(222,47%,11%)] rounded-lg p-4 md:p-6 text-center">
            <p className="text-white text-sm md:text-base">
              <span className="font-semibold">Rick scans all 4 systems</span>
              <span className="mx-2 text-accent">→</span>
              <span className="font-semibold">Identifies your #1 weakness</span>
              <span className="mx-2 text-accent">→</span>
              <span className="font-semibold">Prescribes the exact drill to fix</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function NodeCard({ 
  node, 
  isHovered, 
  isTarget 
}: { 
  node: typeof nodes[0]; 
  isHovered: boolean;
  isTarget: boolean;
}) {
  const Icon = node.icon;
  
  return (
    <div 
      className={`
        bg-card rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-4 w-48 transition-all duration-300
        ${isHovered ? 'scale-105' : ''}
        ${isTarget ? 'ring-2 ring-accent ring-offset-2' : ''}
      `}
      style={{
        boxShadow: isHovered ? `0 8px 24px ${node.color}40` : undefined,
      }}
    >
      {/* Target Badge */}
      {isTarget && (
        <div className="flex justify-center mb-2">
          <span className="inline-flex items-center gap-1 text-xs font-bold text-accent bg-accent/10 px-2 py-0.5 rounded-full">
            ⚠️ TARGET
          </span>
        </div>
      )}
      
      {/* Icon */}
      <div className="flex justify-center mb-3">
        <div 
          className={`w-12 h-12 rounded-full flex items-center justify-center ${node.bgClass}`}
        >
          <Icon className="w-6 h-6 text-white" strokeWidth={2} />
        </div>
      </div>

      {/* Label */}
      <h3 className={`text-center font-bold text-lg uppercase tracking-wide mb-2 ${node.colorClass}`}>
        {node.label}
      </h3>

      {/* Bullets */}
      <ul className="space-y-1">
        {node.bullets.map((bullet) => (
          <li key={bullet} className="text-xs text-muted-foreground text-center">
            {bullet}
          </li>
        ))}
      </ul>
    </div>
  );
}
