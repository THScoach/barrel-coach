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

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size}>
        <circle cx={center} cy={center} r={radius} fill="none" stroke="#1E2535" strokeWidth={10} />
        <circle
          cx={center} cy={center} r={radius}
          fill="none" stroke={color} strokeWidth={10}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
        <text x={center} y={center - 8} textAnchor="middle" fill="#fff" fontSize={36} fontWeight={700} fontFamily="'DM Sans', sans-serif">
          {score !== null ? s : '—'}
        </text>
        <text x={center} y={center + 18} textAnchor="middle" fill={color} fontSize={12} fontWeight={600} fontFamily="'DM Sans', sans-serif">
          {scoreLabel(score)}
        </text>
      </svg>
    </div>
  );
}
