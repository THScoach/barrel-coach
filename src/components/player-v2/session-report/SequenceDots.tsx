interface SequenceDotsProps {
  totalSwings: number;
  correctCount: number;
  isReversed: boolean;
}

export function SequenceDots({ totalSwings, correctCount, isReversed }: SequenceDotsProps) {
  const dots = Array.from({ length: Math.min(totalSwings, 15) }, (_, i) => i < correctCount);

  return (
    <div className="space-y-3">
      {/* Dots row */}
      <div className="flex flex-wrap gap-2 justify-center">
        {dots.map((correct, i) => (
          <div
            key={i}
            className="rounded-full flex items-center justify-center text-xs font-bold"
            style={{
              width: 40, height: 40,
              background: correct ? '#14B8A6' : '#E63946',
              color: '#fff',
              border: '2px solid #222',
            }}
          >
            {i + 1}
          </div>
        ))}
      </div>

      {/* Sequence labels */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ background: '#14B8A6' }} />
          <p className="text-xs font-semibold" style={{ color: '#14B8A6' }}>
            CORRECT ORDER: Hips &gt;&gt; Chest &gt;&gt; Arms &gt;&gt; Bat
          </p>
        </div>
        {isReversed && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ background: '#E63946' }} />
            <p className="text-xs font-semibold" style={{ color: '#E63946' }}>
              YOUR ORDER: Chest &gt;&gt; Hips &gt;&gt; Arms &gt;&gt; Bat
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
