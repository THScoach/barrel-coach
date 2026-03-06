interface TrendSession {
  created_at: string;
  platform_score: number;
  swing_window_score: number;
  ev_floor: number;
  body_score: number;
  brain_score: number;
  bat_score: number;
  ball_score: number;
}

interface TrendboardProps {
  sessions: TrendSession[];
}

function scoreColor(score: number): string {
  if (score >= 80) return '#4ecdc4';
  if (score >= 60) return '#f39c12';
  return '#ff6b6b';
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const w = 120;
  const h = 40;
  const pad = 2;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = pad + (i / (data.length - 1)) * (w - pad * 2);
      const y = pad + (1 - (v - min) / range) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={w} height={h} className="mt-1">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export default function Trendboard({ sessions }: TrendboardProps) {
  if (!sessions || sessions.length === 0) {
    return (
      <div className="rounded-xl bg-slate-800/60 border border-slate-700/40 p-6 text-center">
        <p className="text-sm text-slate-500">No session history yet.</p>
      </div>
    );
  }

  const latest = sessions[sessions.length - 1];
  const first = sessions[0];

  const cards = [
    {
      label: 'Platform Score',
      value: latest.platform_score,
      delta: latest.platform_score - first.platform_score,
      data: sessions.map((s) => s.platform_score),
      suffix: '',
    },
    {
      label: 'Swing Window',
      value: latest.swing_window_score,
      delta: latest.swing_window_score - first.swing_window_score,
      data: sessions.map((s) => s.swing_window_score),
      suffix: '',
    },
    {
      label: 'EV Floor',
      value: latest.ev_floor,
      delta: latest.ev_floor - first.ev_floor,
      data: sessions.map((s) => s.ev_floor),
      suffix: ' mph',
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {cards.map((card) => {
        const color = scoreColor(card.value);
        const improved = card.delta > 0;
        const neutral = card.delta === 0;
        return (
          <div
            key={card.label}
            className="rounded-xl bg-slate-800/80 border border-slate-700/50 p-4 flex flex-col items-center"
          >
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
              {card.label}
            </p>
            <p className="text-3xl font-bold" style={{ color }}>
              {Math.round(card.value)}
              <span className="text-xs font-normal text-slate-500">{card.suffix}</span>
            </p>
            {!neutral && sessions.length > 1 && (
              <span
                className="text-xs font-semibold mt-0.5"
                style={{ color: improved ? '#4ecdc4' : '#ff6b6b' }}
              >
                {improved ? '↑' : '↓'} {Math.abs(Math.round(card.delta))}
              </span>
            )}
            <Sparkline data={card.data} color={color} />
          </div>
        );
      })}
    </div>
  );
}
