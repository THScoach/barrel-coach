import { BarChart, Bar, XAxis, YAxis, Cell, ReferenceLine, ResponsiveContainer, LabelList } from 'recharts';

interface BeforeAfterBarProps {
  before: number | null;
  now: number;
  target?: number | null;
  unit?: string;
  beforeLabel?: string;
  nowLabel?: string;
  targetLabel?: string;
}

export function BeforeAfterBar({ before, now, target, unit = '', beforeLabel = 'Before', nowLabel = 'Now', targetLabel = 'Target' }: BeforeAfterBarProps) {
  const data: { name: string; value: number; fill: string }[] = [];

  if (before != null) {
    data.push({ name: beforeLabel, value: Math.round(before * 10) / 10, fill: '#333' });
  }

  const improved = before != null ? now > before : true;
  data.push({ name: nowLabel, value: Math.round(now * 10) / 10, fill: improved ? '#14B8A6' : '#E63946' });

  const maxVal = Math.max(...data.map(d => d.value), target ?? 0) * 1.3;
  const delta = before != null ? now - before : null;

  return (
    <div className="w-full">
      {delta != null && (
        <p className="text-center mb-1" style={{ fontSize: 28, fontWeight: 800, color: delta >= 0 ? '#14B8A6' : '#E63946' }}>
          {delta >= 0 ? '+' : ''}{Math.round(delta * 10) / 10}{unit}
        </p>
      )}
      <div style={{ width: '100%', height: 100 }}>
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 40, top: 0, bottom: 0 }}>
            <XAxis type="number" domain={[0, maxVal]} hide />
            <YAxis type="category" dataKey="name" tick={{ fill: '#777', fontSize: 11 }} width={50} />
            <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={24}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
              <LabelList dataKey="value" position="right" fill="#fff" fontSize={12} fontWeight={700} formatter={(v: number) => `${v}${unit}`} />
            </Bar>
            {target != null && (
              <ReferenceLine x={target} stroke="#14B8A6" strokeDasharray="4 4" strokeWidth={2} label={{ value: `${targetLabel}: ${target}${unit}`, fill: '#14B8A6', fontSize: 10, position: 'top' }} />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
