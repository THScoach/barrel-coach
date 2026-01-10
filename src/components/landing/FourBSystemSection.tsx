import { Brain, Activity, Zap, Target } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface NodeData {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  bullets: string[];
  position: 'top' | 'left' | 'right' | 'bottom';
}

const nodes: NodeData[] = [
  {
    id: 'brain',
    label: 'BRAIN',
    icon: <Brain className="w-6 h-6" />,
    color: '#8B5CF6',
    bgColor: 'bg-purple-100',
    bullets: ['Timing', 'Pattern Recognition', 'Sync'],
    position: 'top'
  },
  {
    id: 'body',
    label: 'BODY',
    icon: <Activity className="w-6 h-6" />,
    color: '#3B82F6',
    bgColor: 'bg-blue-100',
    bullets: ['Ground-up sequencing', 'Kinetic chain', 'Force creation'],
    position: 'left'
  },
  {
    id: 'bat',
    label: 'BAT',
    icon: <Zap className="w-6 h-6" />,
    color: '#F97316',
    bgColor: 'bg-orange-100',
    bullets: ['Barrel path', 'Transfer efficiency', 'Attack angle'],
    position: 'right'
  },
  {
    id: 'ball',
    label: 'BALL',
    icon: <Target className="w-6 h-6" />,
    color: '#DC2626',
    bgColor: 'bg-red-100',
    bullets: ['Exit velocity', 'Launch angle', 'Contact quality'],
    position: 'bottom'
  }
];

function NodeCard({ node, isHovered, onHover, isWeakest }: { 
  node: NodeData; 
  isHovered: boolean;
  onHover: (id: string | null) => void;
  isWeakest?: boolean;
}) {
  return (
    <div 
      className={cn(
        "relative bg-white rounded-lg p-4 shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-all duration-300 cursor-pointer",
        isHovered && "shadow-lg scale-105",
        isWeakest && "ring-2 ring-red-500"
      )}
      style={{
        boxShadow: isHovered ? `0 8px 24px ${node.color}40` : undefined
      }}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
    >
      {isWeakest && (
        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-semibold">
          ⚠️ TARGET
        </div>
      )}
      
      <div className="flex items-center gap-3 mb-3">
        <div 
          className={cn("w-10 h-10 rounded-full flex items-center justify-center", node.bgColor)}
          style={{ color: node.color }}
        >
          {node.icon}
        </div>
        <span 
          className="font-bold text-lg uppercase tracking-wide"
          style={{ color: node.color }}
        >
          {node.label}
        </span>
      </div>
      
      <ul className="text-sm text-muted-foreground space-y-1">
        {node.bullets.map((bullet, i) => (
          <li key={i} className="flex items-center gap-2">
            <span 
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: node.color }}
            />
            {bullet}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FourBSystemSection() {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [showWeakest, setShowWeakest] = useState(true);

  return (
    <section className="py-20 bg-background">
      <div className="container">
        {/* Section Header */}
        <div className="bg-[#1E3A8A] rounded-t-lg py-4 max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-black text-center text-white uppercase tracking-wide">
            The 4B System
          </h2>
        </div>

        {/* Interactive Node Diagram */}
        <div className="max-w-4xl mx-auto bg-white rounded-b-lg shadow-lg p-6 md:p-10">
          {/* Desktop Layout - Diamond Pattern */}
          <div className="hidden md:block relative">
            {/* Center Batter Silhouette */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 flex items-center justify-center">
              <div className="relative">
                {/* Simple batter silhouette using CSS */}
                <div className="w-20 h-20 bg-[#1E3A8A] rounded-full opacity-20" />
                <svg 
                  viewBox="0 0 100 100" 
                  className="absolute inset-0 w-20 h-20"
                  style={{ fill: '#1E3A8A' }}
                >
                  <circle cx="50" cy="25" r="12" />
                  <path d="M35 40 L35 75 L30 95 L40 95 L45 75 L55 75 L60 95 L70 95 L65 75 L65 40 Z" />
                  <path d="M65 45 L90 25 L92 28 L70 50 Z" />
                </svg>
              </div>
            </div>

            {/* Connection Lines */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ height: '400px' }}>
              <defs>
                <pattern id="dotPattern" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="1" fill="#D1D5DB" />
                </pattern>
              </defs>
              {/* Lines from center to each node */}
              <line x1="50%" y1="50%" x2="50%" y2="15%" stroke="#D1D5DB" strokeWidth="2" strokeDasharray="6 4" />
              <line x1="50%" y1="50%" x2="15%" y2="50%" stroke="#D1D5DB" strokeWidth="2" strokeDasharray="6 4" />
              <line x1="50%" y1="50%" x2="85%" y2="50%" stroke="#D1D5DB" strokeWidth="2" strokeDasharray="6 4" />
              <line x1="50%" y1="50%" x2="50%" y2="85%" stroke="#D1D5DB" strokeWidth="2" strokeDasharray="6 4" />
            </svg>

            {/* Nodes Grid */}
            <div className="grid grid-cols-3 gap-4" style={{ minHeight: '400px' }}>
              {/* Top - Brain */}
              <div className="col-start-2 flex justify-center">
                <div className="w-64">
                  <NodeCard 
                    node={nodes[0]} 
                    isHovered={hoveredNode === 'brain'}
                    onHover={setHoveredNode}
                  />
                </div>
              </div>

              {/* Middle Row - Body, Center Space, Bat */}
              <div className="flex justify-end items-center">
                <div className="w-64">
                  <NodeCard 
                    node={nodes[1]} 
                    isHovered={hoveredNode === 'body'}
                    onHover={setHoveredNode}
                    isWeakest={showWeakest}
                  />
                </div>
              </div>
              <div /> {/* Center space for batter */}
              <div className="flex justify-start items-center">
                <div className="w-64">
                  <NodeCard 
                    node={nodes[2]} 
                    isHovered={hoveredNode === 'bat'}
                    onHover={setHoveredNode}
                  />
                </div>
              </div>

              {/* Bottom - Ball */}
              <div className="col-start-2 flex justify-center">
                <div className="w-64">
                  <NodeCard 
                    node={nodes[3]} 
                    isHovered={hoveredNode === 'ball'}
                    onHover={setHoveredNode}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Layout - Vertical Stack */}
          <div className="md:hidden space-y-4">
            {nodes.map((node) => (
              <NodeCard 
                key={node.id}
                node={node} 
                isHovered={hoveredNode === node.id}
                onHover={setHoveredNode}
                isWeakest={showWeakest && node.id === 'body'}
              />
            ))}
          </div>
        </div>

        {/* Bottom Banner */}
        <div className="max-w-4xl mx-auto mt-6">
          <div className="bg-[#1E3A8A] text-white rounded-lg px-6 py-4 text-center">
            <p className="text-sm md:text-base">
              <span className="font-semibold">Rick scans all 4 systems</span>
              <span className="mx-2">→</span>
              <span className="font-semibold">Identifies your #1 weakness</span>
              <span className="mx-2">→</span>
              <span className="font-semibold">Prescribes the exact drill to fix</span>
            </p>
          </div>
        </div>

        {/* Bottom Tagline */}
        <div className="max-w-3xl mx-auto mt-8 text-center">
          <p className="text-lg md:text-xl text-foreground">
            Most coaches guess. <span className="text-[#DC2626] font-semibold">We measure.</span> Then we fix the weakest link.
          </p>
        </div>
      </div>
    </section>
  );
}
