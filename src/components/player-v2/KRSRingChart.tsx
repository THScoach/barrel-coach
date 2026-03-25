import { scoreColor, scoreLabel } from "@/lib/player-utils";

interface KRSRingChartProps {
  score: number | null;
  size?: number;
}

export function KRSRingChart({ score, size = 180 }: KRSRingChartProps) {
  const s = score ?? 0;
  const color = scoreColor(s);
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (s / 100) * circumference;
  const center = size / 2;
  const label = scoreLabel(score);

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} className="drop-shadow-lg">
        <defs>
          <filter id="krs-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="ring-bg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1a1a1a" />
            <stop offset="100%" stopColor="#111111" />
          </linearGradient>
        </defs>
        {/* Background ring */}
        <circle cx={center} cy={center} r={radius} fill="none" stroke="url(#ring-bg)" strokeWidth={12} />
        {/* Score ring with glow */}
        {score !== null && (
          <circle
            cx={center} cy={center} r={radius}
            fill="none" stroke={color} strokeWidth={12}
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${center} ${center})`}
            filter="url(#krs-glow)"
            style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)' }}
          />
        )}
        {/* Score number */}
        <text
          x={center} y={center - 6}
          textAnchor="middle" fill="#fff"
          fontSize={40} fontWeight={800}
          fontFamily="'DM Sans', sans-serif"
        >
          {score !== null ? s : '—'}
        </text>
        {/* Label */}
        <text
          x={center} y={center + 16}
          textAnchor="middle" fill={score !== null ? color : '#555'}
          fontSize={11} fontWeight={700}
          fontFamily="'DM Sans', sans-serif"
          letterSpacing="1.5"
        >
          {label}
        </text>
      </svg>
      <p className="text-[11px] font-semibold mt-1 tracking-widest uppercase" style={{ color: '#555' }}>
        KRS Score
      </p>
    </div>
  );
}
