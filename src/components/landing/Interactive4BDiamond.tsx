import { useState } from 'react';
import { Brain, Activity, Zap, Target, X, Check } from 'lucide-react';

interface NodeData {
  id: 'brain' | 'body' | 'bat' | 'ball';
  label: string;
  icon: typeof Brain;
  color: string;
  borderColor: string;
  glowColor: string;
  score: number;
  description: string;
  metrics: string[];
}

const nodes: NodeData[] = [
  {
    id: 'brain',
    label: 'BRAIN',
    icon: Brain,
    color: 'text-brain-purple',
    borderColor: 'border-brain-purple',
    glowColor: 'shadow-brain-purple/40',
    score: 58,
    description: 'Pitch recognition, timing, and decision-making',
    metrics: ['Pitch recognition speed', 'Timing consistency', 'Swing decisions'],
  },
  {
    id: 'body',
    label: 'BODY',
    icon: Activity,
    color: 'text-body-blue',
    borderColor: 'border-body-blue',
    glowColor: 'shadow-body-blue/40',
    score: 65,
    description: 'Ground connection, hip rotation, and kinetic chain',
    metrics: ['Ground reaction force', 'Hip-shoulder separation', 'Weight transfer'],
  },
  {
    id: 'bat',
    label: 'BAT',
    icon: Zap,
    color: 'text-bat-orange',
    borderColor: 'border-bat-orange',
    glowColor: 'shadow-bat-orange/40',
    score: 52,
    description: 'Bat path, hand speed, and barrel control',
    metrics: ['Bat speed', 'Attack angle', 'Barrel accuracy'],
  },
  {
    id: 'ball',
    label: 'BALL',
    icon: Target,
    color: 'text-ball-red',
    borderColor: 'border-ball-red',
    glowColor: 'shadow-ball-red/40',
    score: 68,
    description: 'Exit velocity, launch angle, and contact quality',
    metrics: ['Exit velocity', 'Launch angle', 'Hard hit rate'],
  },
];

export function Interactive4BDiamond() {
  const [activeNode, setActiveNode] = useState<NodeData | null>(null);

  return (
    <section className="bg-primary py-24 overflow-hidden">
      <div className="container">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="inline-block bg-brain-purple text-white text-sm font-bold uppercase tracking-wider px-4 py-2 rounded-full mb-4">
            The 4B System™
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            DIAGNOSE YOUR SWING LIKE A PRO
          </h2>
          <p className="text-xl text-gray-400 max-w-xl mx-auto">
            Every swing problem falls into one of four categories. Find your weakest link. Fix it first.
          </p>
        </div>

        {/* Interactive Diamond */}
        <div className="relative max-w-4xl mx-auto h-[600px] md:h-[700px]">
          {/* Center Diamond */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 md:w-40 md:h-40 rounded-full bg-navy-800 border-2 border-navy-700 flex flex-col items-center justify-center z-10">
            <Target className="w-10 h-10 text-slate-400 mb-1" />
            <span className="text-xs text-slate-400 uppercase tracking-wider">4B Score</span>
          </div>

          {/* Connection Lines (Visual only) */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 400 400">
            <line x1="200" y1="60" x2="60" y2="200" stroke="hsl(var(--navy-700))" strokeWidth="2" strokeDasharray="4 4" />
            <line x1="200" y1="60" x2="340" y2="200" stroke="hsl(var(--navy-700))" strokeWidth="2" strokeDasharray="4 4" />
            <line x1="60" y1="200" x2="200" y2="340" stroke="hsl(var(--navy-700))" strokeWidth="2" strokeDasharray="4 4" />
            <line x1="340" y1="200" x2="200" y2="340" stroke="hsl(var(--navy-700))" strokeWidth="2" strokeDasharray="4 4" />
          </svg>

          {/* Brain Node - Top */}
          <NodeButton
            node={nodes[0]}
            position="top-0 left-1/2 -translate-x-1/2"
            isActive={activeNode?.id === 'brain'}
            onClick={() => setActiveNode(activeNode?.id === 'brain' ? null : nodes[0])}
          />

          {/* Body Node - Left */}
          <NodeButton
            node={nodes[1]}
            position="top-1/2 left-0 -translate-y-1/2"
            isActive={activeNode?.id === 'body'}
            onClick={() => setActiveNode(activeNode?.id === 'body' ? null : nodes[1])}
          />

          {/* Bat Node - Right */}
          <NodeButton
            node={nodes[2]}
            position="top-1/2 right-0 -translate-y-1/2"
            isActive={activeNode?.id === 'bat'}
            onClick={() => setActiveNode(activeNode?.id === 'bat' ? null : nodes[2])}
          />

          {/* Ball Node - Bottom */}
          <NodeButton
            node={nodes[3]}
            position="bottom-0 left-1/2 -translate-x-1/2"
            isActive={activeNode?.id === 'ball'}
            onClick={() => setActiveNode(activeNode?.id === 'ball' ? null : nodes[3])}
          />

          {/* Detail Panel */}
          {activeNode && (
            <div className="absolute bottom-[-80px] left-1/2 -translate-x-1/2 w-full max-w-md bg-navy-800 rounded-2xl p-6 text-center z-30 animate-fade-in">
              <button 
                onClick={() => setActiveNode(null)}
                className="absolute top-3 right-3 text-gray-500 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
              
              <h3 className={`text-2xl font-bold ${activeNode.color} mb-2`}>
                {activeNode.label} <span className="text-white">Score: {activeNode.score}</span>
              </h3>
              <p className="text-gray-400 mb-4">{activeNode.description}</p>
              
              <div className="flex justify-center gap-8 mb-4">
                <div className="text-center">
                  <div className={`text-3xl font-bold ${activeNode.color}`}>{activeNode.score}</div>
                  <div className="text-xs text-slate-400 uppercase">Current</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-success">70</div>
                  <div className="text-xs text-slate-400 uppercase">Target</div>
                </div>
              </div>

              <ul className="text-left space-y-2">
                {activeNode.metrics.map((metric, i) => (
                  <li key={i} className="flex items-center gap-3 text-gray-300 text-sm border-b border-navy-700 pb-2">
                    <Check className="w-4 h-4 text-success flex-shrink-0" />
                    {metric}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function NodeButton({ 
  node, 
  position, 
  isActive, 
  onClick 
}: { 
  node: NodeData; 
  position: string; 
  isActive: boolean; 
  onClick: () => void;
}) {
  const Icon = node.icon;
  
  return (
    <button
      onClick={onClick}
      className={`
        absolute ${position}
        w-36 h-36 md:w-44 md:h-44
        rounded-full
        bg-navy-800
        border-3 ${node.borderColor}
        flex flex-col items-center justify-center
        cursor-pointer
        transition-all duration-300
        z-20
        ${isActive 
          ? `scale-110 shadow-xl ${node.glowColor}` 
          : 'hover:scale-105'
        }
      `}
    >
      <Icon className={`w-9 h-9 ${node.color} mb-2`} />
      <span className={`text-sm font-bold uppercase tracking-wider ${node.color}`}>
        {node.label}
      </span>
      <span className="text-xs text-slate-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
        Click to explore
      </span>
    </button>
  );
}
