import { useState } from 'react';

// Simple wireframe box component
const Box = ({ 
  label, 
  height = 'h-12', 
  className = '' 
}: { 
  label: string; 
  height?: string; 
  className?: string;
}) => (
  <div className={`bg-gray-300 border-2 border-gray-400 rounded flex items-center justify-center text-gray-700 text-xs font-medium ${height} ${className}`}>
    {label}
  </div>
);

// Section wrapper
const Section = ({ 
  title, 
  children 
}: { 
  title: string; 
  children: React.ReactNode;
}) => (
  <div className="border-2 border-gray-500 rounded-lg p-3 space-y-2">
    <div className="text-[10px] font-bold text-gray-600 uppercase tracking-wide border-b border-gray-400 pb-1">
      {title}
    </div>
    {children}
  </div>
);

// Frame 1: Full Data
function FullDataFrame() {
  return (
    <div className="space-y-3">
      {/* 1. Header */}
      <Section title="1. Header">
        <Box label="Athlete Name" height="h-8" />
        <div className="flex gap-2">
          <Box label="Age" height="h-6" className="flex-1" />
          <Box label="Level" height="h-6" className="flex-1" />
        </div>
        <Box label="Session Date" height="h-6" />
      </Section>

      {/* 2. Scoreboard */}
      <Section title="2. Scoreboard">
        <Box label="COMPOSITE SCORE (0-100)" height="h-20" />
        <div className="space-y-1">
          <Box label="BODY ████████░░" height="h-6" />
          <Box label="BRAIN ██████░░░░" height="h-6" />
          <Box label="BAT █████████░" height="h-6" />
          <Box label="BALL ███████░░░" height="h-6" />
        </div>
        <div className="text-[8px] text-gray-500 italic text-center">
          "Scores go up by fixing leaks — not swinging harder."
        </div>
      </Section>

      {/* 3. Kinetic Potential */}
      <Section title="3. Kinetic Potential">
        <Box label="Kinetic Potential ████████████" height="h-6" />
        <Box label="Current Expression ████████░░░░" height="h-6" />
        <div className="text-[8px] text-gray-500 text-center">
          [One sentence explanation]
        </div>
      </Section>

      {/* 4. Primary Leak */}
      <Section title="4. Primary Leak">
        <Box label="[Image/Loop Placeholder]" height="h-32" />
        <Box label="Overlay Label" height="h-6" />
        <Box label="Title + One-line explanation" height="h-10" />
      </Section>

      {/* 5. Fix Order */}
      <Section title="5. Fix Order">
        <div className="space-y-1">
          <Box label="☐ Step 1: [Feel cue]" height="h-8" />
          <Box label="☐ Step 2: [Feel cue]" height="h-8" />
          <Box label="☐ Step 3: [Feel cue]" height="h-8" />
        </div>
        <div className="bg-yellow-200 border-2 border-yellow-400 rounded p-2 text-[8px] text-gray-700">
          ⚠️ Do NOT chase: hands, bat path, swing harder
        </div>
      </Section>

      {/* 6. Square-Up Window */}
      <Section title="6. Square-Up Window">
        <div className="grid grid-cols-3 gap-1">
          {[...Array(9)].map((_, i) => (
            <Box key={i} label="" height="h-10" />
          ))}
        </div>
        <div className="text-[8px] text-gray-600 text-center">
          Label: "Best Square-Up Zone"
        </div>
        <div className="text-[8px] text-gray-500 italic text-center">
          [One coaching sentence]
        </div>
      </Section>

      {/* 7. Weapon Panel (DK) */}
      <Section title="7. Weapon Panel (Diamond Kinetics)">
        <div className="grid grid-cols-2 gap-2">
          <Box label="WIP Index" height="h-12" />
          <Box label="Plane Integrity" height="h-12" />
          <Box label="Square-Up Consistency" height="h-12" />
          <Box label="Impact Momentum" height="h-12" />
        </div>
      </Section>

      {/* 8. Projected Ball Outcomes */}
      <Section title="8. Projected Ball Outcomes">
        <div className="text-[8px] text-gray-600 mb-1">Label: "Projected"</div>
        <div className="grid grid-cols-2 gap-2">
          <Box label="EV Range" height="h-12" />
          <Box label="Hard-Hit %" height="h-12" />
        </div>
      </Section>

      {/* 9. This Week's Work */}
      <Section title="9. This Week's Work">
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border border-gray-400 rounded p-2 space-y-1">
              <Box label="[Video Placeholder]" height="h-16" />
              <Box label={`Drill ${i} Name`} height="h-6" />
              <div className="text-[8px] text-gray-500 italic">[One cue]</div>
            </div>
          ))}
        </div>
      </Section>

      {/* 10. Progress Board */}
      <Section title="10. Progress Board">
        <div className="space-y-1">
          <Box label="Jan 14 — 70 ▲+3" height="h-6" />
          <Box label="Jan 7 — 67 ▲+2" height="h-6" />
          <Box label="Dec 28 — 65 ▼-1" height="h-6" />
        </div>
        <div className="flex gap-1 mt-2">
          <Box label="🏅 Badge" height="h-6" className="flex-1" />
          <Box label="🏅 Badge" height="h-6" className="flex-1" />
        </div>
      </Section>

      {/* 11. Coach Note */}
      <Section title="11. Coach Note">
        <Box label="[Paragraph placeholder]" height="h-16" />
        <div className="flex gap-2">
          <Box label="🔊 Audio" height="h-6" className="flex-1" />
          <Box label="🎥 Video" height="h-6" className="flex-1" />
        </div>
      </Section>
    </div>
  );
}

// Frame 2: No DK / No Ball
function NoDKNoBallFrame() {
  return (
    <div className="space-y-3">
      {/* 1. Header */}
      <Section title="1. Header">
        <Box label="Athlete Name" height="h-8" />
        <div className="flex gap-2">
          <Box label="Age" height="h-6" className="flex-1" />
          <Box label="Level" height="h-6" className="flex-1" />
        </div>
        <Box label="Session Date" height="h-6" />
      </Section>

      {/* 2. Scoreboard */}
      <Section title="2. Scoreboard">
        <Box label="COMPOSITE SCORE (0-100)" height="h-20" />
        <div className="space-y-1">
          <Box label="BODY ████████░░" height="h-6" />
          <Box label="BRAIN ██████░░░░" height="h-6" />
          <Box label="BAT (Projected)" height="h-6" />
          <Box label="BALL (Projected)" height="h-6" />
        </div>
        <div className="text-[8px] text-gray-500 italic text-center">
          "Scores go up by fixing leaks — not swinging harder."
        </div>
      </Section>

      {/* 3. Kinetic Potential */}
      <Section title="3. Kinetic Potential">
        <Box label="Kinetic Potential ████████████" height="h-6" />
        <Box label="Current Expression ████████░░░░" height="h-6" />
        <div className="text-[8px] text-gray-500 text-center">
          [One sentence explanation]
        </div>
      </Section>

      {/* 4. Primary Leak */}
      <Section title="4. Primary Leak">
        <Box label="[Image/Loop Placeholder]" height="h-32" />
        <Box label="Overlay Label" height="h-6" />
        <Box label="Title + One-line explanation" height="h-10" />
      </Section>

      {/* 5. Fix Order */}
      <Section title="5. Fix Order">
        <div className="space-y-1">
          <Box label="☐ Step 1: [Feel cue]" height="h-8" />
          <Box label="☐ Step 2: [Feel cue]" height="h-8" />
          <Box label="☐ Step 3: [Feel cue]" height="h-8" />
        </div>
        <div className="bg-yellow-200 border-2 border-yellow-400 rounded p-2 text-[8px] text-gray-700">
          ⚠️ Do NOT chase: hands, bat path, swing harder
        </div>
      </Section>

      {/* 6. Square-Up Window - STILL SHOWS (predicted from body) */}
      <Section title="6. Square-Up Window (Predicted)">
        <div className="grid grid-cols-3 gap-1">
          {[...Array(9)].map((_, i) => (
            <Box key={i} label="" height="h-10" />
          ))}
        </div>
        <div className="text-[8px] text-gray-600 text-center">
          Label: "Predicted Square-Up Zone"
        </div>
        <div className="text-[8px] text-gray-500 italic text-center">
          [Based on body mechanics]
        </div>
      </Section>

      {/* 7. Weapon Panel — HIDDEN */}
      <div className="border-2 border-dashed border-red-300 rounded-lg p-3 bg-red-50">
        <div className="text-[10px] font-bold text-red-400 uppercase">
          ❌ 7. Weapon Panel — HIDDEN (No DK Data)
        </div>
      </div>

      {/* 8. Ball Outcomes — HIDDEN */}
      <div className="border-2 border-dashed border-red-300 rounded-lg p-3 bg-red-50">
        <div className="text-[10px] font-bold text-red-400 uppercase">
          ❌ 8. Ball Outcomes — HIDDEN (No Ball Data)
        </div>
      </div>

      {/* 9. This Week's Work */}
      <Section title="9. This Week's Work">
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border border-gray-400 rounded p-2 space-y-1">
              <Box label="[Video Placeholder]" height="h-16" />
              <Box label={`Drill ${i} Name`} height="h-6" />
              <div className="text-[8px] text-gray-500 italic">[One cue]</div>
            </div>
          ))}
        </div>
      </Section>

      {/* 10. Progress Board */}
      <Section title="10. Progress Board">
        <div className="space-y-1">
          <Box label="Jan 14 — 70 ▲+3" height="h-6" />
          <Box label="Jan 7 — 67 ▲+2" height="h-6" />
          <Box label="Dec 28 — 65 ▼-1" height="h-6" />
        </div>
        <div className="flex gap-1 mt-2">
          <Box label="🏅 Badge" height="h-6" className="flex-1" />
          <Box label="🏅 Badge" height="h-6" className="flex-1" />
        </div>
      </Section>

      {/* 11. Coach Note */}
      <Section title="11. Coach Note">
        <Box label="[Paragraph placeholder]" height="h-16" />
        <div className="flex gap-2">
          <Box label="🔊 Audio" height="h-6" className="flex-1" />
          <Box label="🎥 Video" height="h-6" className="flex-1" />
        </div>
      </Section>
    </div>
  );
}

// Frame 3: Minimal Data (Reboot Only, First Session)
function MinimalDataFrame() {
  return (
    <div className="space-y-3">
      {/* 1. Header */}
      <Section title="1. Header">
        <Box label="Athlete Name" height="h-8" />
        <div className="flex gap-2">
          <Box label="Age" height="h-6" className="flex-1" />
          <Box label="Level" height="h-6" className="flex-1" />
        </div>
        <Box label="Session Date (FIRST SESSION)" height="h-6" />
      </Section>

      {/* 2. Scoreboard - Baseline Only */}
      <Section title="2. Scoreboard (Baseline)">
        <Box label="COMPOSITE SCORE (0-100)" height="h-20" />
        <div className="space-y-1">
          <Box label="BODY ████████░░" height="h-6" />
          <Box label="BRAIN ██████░░░░" height="h-6" />
          <Box label="BAT (Projected)" height="h-6" />
          <Box label="BALL (Projected)" height="h-6" />
        </div>
        <div className="text-[8px] text-gray-500 italic text-center">
          "This is your baseline. Let's build from here."
        </div>
      </Section>

      {/* 3. Kinetic Potential */}
      <Section title="3. Kinetic Potential">
        <Box label="Kinetic Potential ████████████" height="h-6" />
        <Box label="Current Expression ████████░░░░" height="h-6" />
        <div className="text-[8px] text-gray-500 text-center">
          [One sentence explanation]
        </div>
      </Section>

      {/* 4. Primary Leak */}
      <Section title="4. Primary Leak">
        <Box label="[Image/Loop Placeholder]" height="h-32" />
        <Box label="Overlay Label" height="h-6" />
        <Box label="Title + One-line explanation" height="h-10" />
      </Section>

      {/* 5. Fix Order */}
      <Section title="5. Fix Order">
        <div className="space-y-1">
          <Box label="☐ Step 1: [Feel cue]" height="h-8" />
          <Box label="☐ Step 2: [Feel cue]" height="h-8" />
          <Box label="☐ Step 3: [Feel cue]" height="h-8" />
        </div>
        <div className="bg-yellow-200 border-2 border-yellow-400 rounded p-2 text-[8px] text-gray-700">
          ⚠️ Do NOT chase: hands, bat path, swing harder
        </div>
      </Section>

      {/* 6. Square-Up Window - SHOWS AS EARLY ESTIMATE */}
      <Section title="6. Square-Up Window (Early Estimate)">
        <div className="grid grid-cols-3 gap-1">
          {[...Array(9)].map((_, i) => (
            <Box key={i} label="" height="h-10" />
          ))}
        </div>
        <div className="text-[8px] text-gray-600 text-center">
          Label: "Early Estimate"
        </div>
        <div className="text-[8px] text-gray-500 italic text-center">
          Sharpens as we collect more swings.
        </div>
      </Section>

      {/* 7. Weapon Panel — HIDDEN */}
      <div className="border-2 border-dashed border-red-300 rounded-lg p-3 bg-red-50">
        <div className="text-[10px] font-bold text-red-400 uppercase">
          ❌ 7. Weapon Panel — HIDDEN (No DK Data)
        </div>
      </div>

      {/* 8. Ball Outcomes — HIDDEN */}
      <div className="border-2 border-dashed border-red-300 rounded-lg p-3 bg-red-50">
        <div className="text-[10px] font-bold text-red-400 uppercase">
          ❌ 8. Ball Outcomes — HIDDEN (No Ball Data)
        </div>
      </div>

      {/* 9. This Week's Work */}
      <Section title="9. This Week's Work">
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border border-gray-400 rounded p-2 space-y-1">
              <Box label="[Video Placeholder]" height="h-16" />
              <Box label={`Drill ${i} Name`} height="h-6" />
              <div className="text-[8px] text-gray-500 italic">[One cue]</div>
            </div>
          ))}
        </div>
      </Section>

      {/* 10. Progress Board — MINIMAL */}
      <Section title="10. Progress Board (First Session)">
        <div className="space-y-1">
          <Box label="Jan 14 — 70 (Baseline)" height="h-6" />
        </div>
        <div className="text-[8px] text-gray-500 italic text-center">
          "Check back after your next session to see progress."
        </div>
      </Section>

      {/* 11. Coach Note */}
      <Section title="11. Coach Note">
        <Box label="[Paragraph placeholder]" height="h-16" />
        <div className="flex gap-2">
          <Box label="🔊 Audio" height="h-6" className="flex-1" />
          <Box label="🎥 Video" height="h-6" className="flex-1" />
        </div>
      </Section>
    </div>
  );
}

export default function ReportWireframes() {
  const [activeFrame, setActiveFrame] = useState<1 | 2 | 3>(1);

  const frames = [
    { id: 1, label: 'Full Data', desc: 'Reboot + DK + Ball' },
    { id: 2, label: 'No DK/Ball', desc: 'Reboot Only' },
    { id: 3, label: 'Minimal', desc: 'First Session' },
  ] as const;

  return (
    <div className="min-h-screen bg-white">
      {/* Frame Selector */}
      <div className="sticky top-0 bg-white border-b-2 border-gray-300 p-3 z-10">
        <h1 className="text-sm font-bold text-gray-800 text-center mb-2">
          WIREFRAME: Player Swing Report
        </h1>
        <div className="flex gap-2 justify-center">
          {frames.map((frame) => (
            <button
              key={frame.id}
              onClick={() => setActiveFrame(frame.id)}
              className={`px-3 py-2 rounded text-xs font-medium transition-colors ${
                activeFrame === frame.id
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              <div>{frame.label}</div>
              <div className="text-[8px] opacity-70">{frame.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* iPhone Frame */}
      <div className="flex justify-center py-6">
        <div className="w-[375px] bg-gray-100 border-4 border-gray-400 rounded-3xl p-4 shadow-lg">
          <div className="text-[10px] text-gray-500 text-center mb-2 uppercase tracking-wide">
            Frame {activeFrame}: {frames.find(f => f.id === activeFrame)?.label}
          </div>
          
          {activeFrame === 1 && <FullDataFrame />}
          {activeFrame === 2 && <NoDKNoBallFrame />}
          {activeFrame === 3 && <MinimalDataFrame />}
        </div>
      </div>

      {/* Legend */}
      <div className="max-w-md mx-auto px-4 pb-8">
        <div className="border-2 border-gray-300 rounded-lg p-3 space-y-2">
          <div className="text-[10px] font-bold text-gray-600 uppercase">Legend</div>
          <div className="flex items-center gap-2 text-[10px]">
            <div className="w-6 h-4 bg-gray-300 border-2 border-gray-400 rounded" />
            <span>Content placeholder</span>
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            <div className="w-6 h-4 bg-red-50 border-2 border-dashed border-red-300 rounded" />
            <span>Hidden section (data unavailable)</span>
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            <div className="w-6 h-4 bg-yellow-200 border-2 border-yellow-400 rounded" />
            <span>Warning/caution box</span>
          </div>
        </div>
      </div>
    </div>
  );
}
