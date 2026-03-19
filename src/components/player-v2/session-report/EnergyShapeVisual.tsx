interface Props {
  tkeShape: string | undefined;
}

export function EnergyShapeVisual({ tkeShape }: Props) {
  // Only show for problematic shapes
  if (!tkeShape || tkeShape === 'single_spike') return null;

  const isDoubleBump = tkeShape === 'double_bump';
  const label = isDoubleBump ? 'Double Bump' : 'Plateau';
  const description = isDoubleBump
    ? 'Your energy is spiking twice instead of once. That means your body is firing in two separate pulses instead of one coordinated wave.'
    : 'Your energy stays elevated instead of spiking. That means the brake didn\'t fire, so energy never concentrated into the barrel.';

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: '#111', border: '1px solid #222' }}>
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#777' }}>
        Energy Shape: Should Spike Once{isDoubleBump ? ', Not Twice' : ''}
      </p>

      <div className="grid grid-cols-2 gap-4">
        {/* Healthy swing */}
        <div className="text-center">
          <svg viewBox="0 0 120 60" className="w-full h-16">
            <path
              d="M 10,55 Q 30,50 45,30 Q 55,10 65,10 Q 75,10 85,30 Q 100,50 110,55"
              fill="none"
              stroke="#14B8A6"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
          <p className="text-[10px] mt-1" style={{ color: '#14B8A6' }}>Healthy Swing</p>
          <p className="text-[9px]" style={{ color: '#555' }}>One sharp spike = body fires as one wave</p>
        </div>

        {/* Problem swing */}
        <div className="text-center">
          <svg viewBox="0 0 120 60" className="w-full h-16">
            {isDoubleBump ? (
              <path
                d="M 10,55 Q 25,45 35,25 Q 40,15 45,25 Q 50,40 55,40 Q 60,40 65,25 Q 70,15 75,25 Q 85,45 110,55"
                fill="none"
                stroke="#E63946"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M 10,55 Q 25,45 35,25 Q 45,15 55,15 Q 65,15 75,15 Q 85,15 95,25 Q 105,45 110,55"
                fill="none"
                stroke="#E63946"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            )}
          </svg>
          <p className="text-[10px] mt-1" style={{ color: '#E63946' }}>Your Swing: {label}</p>
          <p className="text-[9px]" style={{ color: '#555' }}>
            {isDoubleBump ? 'Multiple bumps = body fires in pieces' : 'Flat top = brake didn\'t fire'}
          </p>
        </div>
      </div>

      <p className="text-xs leading-relaxed" style={{ color: '#999' }}>{description}</p>
    </div>
  );
}
