import { Brain, Activity, Zap, Target, Download } from 'lucide-react';
import { useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';

interface FourBFrameworkDiagramProps {
  showExport?: boolean;
  className?: string;
}

const pillars = [
  {
    id: 'brain',
    label: 'BRAIN',
    icon: Brain,
    color: '#8B5CF6', // Purple
    metrics: ['Timing', 'Decision', 'Sync'],
    position: { angle: -45, x: 0, y: -1 } // Top-right quadrant
  },
  {
    id: 'body',
    label: 'BODY',
    icon: Activity,
    color: '#DC2626', // Red (Swing Rehab brand)
    metrics: ['Power', 'Sequencing', 'Ground Force'],
    position: { angle: 45, x: 1, y: 0 } // Right quadrant
  },
  {
    id: 'bat',
    label: 'BAT',
    icon: Zap,
    color: '#3B82F6', // Blue
    metrics: ['Path', 'Control', 'Barrel Delivery'],
    position: { angle: 135, x: 0, y: 1 } // Bottom quadrant
  },
  {
    id: 'ball',
    label: 'BALL',
    icon: Target,
    color: '#22C55E', // Green
    metrics: ['Exit Velo', 'Launch Angle', 'Contact Quality'],
    position: { angle: -135, x: -1, y: 0 } // Left quadrant
  }
];

export function FourBFrameworkDiagram({ showExport = true, className = '' }: FourBFrameworkDiagramProps) {
  const diagramRef = useRef<HTMLDivElement>(null);

  const handleExport = useCallback(async () => {
    if (!diagramRef.current) return;
    
    try {
      // Dynamic import for html2canvas
      const html2canvas = (await import('html2canvas')).default;
      
      const canvas = await html2canvas(diagramRef.current, {
        backgroundColor: '#0A0A0B',
        scale: 2, // Higher resolution
        useCORS: true,
      });
      
      const link = document.createElement('a');
      link.download = '4b-framework-diagram.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Export failed:', error);
    }
  }, []);

  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      {/* Diagram Container */}
      <div 
        ref={diagramRef}
        className="relative w-full max-w-[600px] aspect-square bg-[#0A0A0B] rounded-2xl p-8"
      >
        {/* Connection Lines */}
        <svg 
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Lines from center to each pillar */}
          {pillars.map((pillar, index) => {
            const angle = (index * 90 - 45) * (Math.PI / 180);
            const endX = 50 + Math.cos(angle) * 32;
            const endY = 50 + Math.sin(angle) * 32;
            return (
              <line
                key={pillar.id}
                x1="50"
                y1="50"
                x2={endX}
                y2={endY}
                stroke={pillar.color}
                strokeWidth="0.5"
                strokeOpacity="0.4"
                strokeDasharray="2,2"
              />
            );
          })}
          
          {/* Outer ring */}
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="#374151"
            strokeWidth="0.3"
            strokeOpacity="0.5"
          />
        </svg>

        {/* KRS Center Node */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
          <div className="relative">
            {/* Glow effect */}
            <div className="absolute inset-0 bg-amber-500/20 rounded-full blur-xl scale-150" />
            
            {/* Main circle */}
            <div className="relative w-24 h-24 md:w-28 md:h-28 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex flex-col items-center justify-center shadow-lg border-2 border-amber-300/50">
              <span className="text-black font-black text-lg md:text-xl tracking-tight">KRS</span>
              <span className="text-black/70 text-[10px] md:text-xs font-medium">Kinetic</span>
              <span className="text-black/70 text-[10px] md:text-xs font-medium -mt-0.5">Readiness</span>
            </div>
          </div>
        </div>

        {/* Pillar Nodes */}
        {pillars.map((pillar, index) => {
          const angle = (index * 90 - 45) * (Math.PI / 180);
          const radius = 38; // percentage from center
          const left = 50 + Math.cos(angle) * radius;
          const top = 50 + Math.sin(angle) * radius;
          const Icon = pillar.icon;

          return (
            <div
              key={pillar.id}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${left}%`,
                top: `${top}%`,
              }}
            >
              {/* Glow */}
              <div 
                className="absolute inset-0 rounded-xl blur-md scale-110 opacity-30"
                style={{ backgroundColor: pillar.color }}
              />
              
              {/* Card */}
              <div 
                className="relative bg-slate-900/90 backdrop-blur-sm rounded-xl p-3 md:p-4 border shadow-lg min-w-[100px] md:min-w-[130px]"
                style={{ borderColor: `${pillar.color}50` }}
              >
                {/* Header */}
                <div className="flex items-center gap-2 mb-2">
                  <div 
                    className="w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${pillar.color}20` }}
                  >
                    <Icon className="w-4 h-4 md:w-5 md:h-5" style={{ color: pillar.color }} />
                  </div>
                  <span 
                    className="font-bold text-xs md:text-sm tracking-wide"
                    style={{ color: pillar.color }}
                  >
                    {pillar.label}
                  </span>
                </div>
                
                {/* Metrics */}
                <ul className="space-y-0.5">
                  {pillar.metrics.map((metric) => (
                    <li 
                      key={metric} 
                      className="text-[10px] md:text-xs text-slate-400 flex items-center gap-1.5"
                    >
                      <span 
                        className="w-1 h-1 rounded-full flex-shrink-0"
                        style={{ backgroundColor: pillar.color }}
                      />
                      {metric}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}

        {/* Tagline */}
        <div className="absolute bottom-4 left-0 right-0 text-center">
          <p className="text-slate-500 text-xs md:text-sm italic">
            "We don't add. <span className="text-amber-500 font-medium">We unlock.</span>"
          </p>
        </div>
      </div>

      {/* Export Button */}
      {showExport && (
        <Button 
          onClick={handleExport}
          variant="outline"
          className="gap-2"
        >
          <Download className="w-4 h-4" />
          Download PNG
        </Button>
      )}
    </div>
  );
}
