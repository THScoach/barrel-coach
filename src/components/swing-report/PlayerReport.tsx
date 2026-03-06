import { useState } from 'react';
import type { SessionMetrics, ComputedScores, FullReport } from '@/lib/swing/scoring-engine';
import type { PlayerView as PlayerViewType } from '@/lib/swing/player-view';

// ─── Types ──────────────────────────────────────────────────────────────────

interface PlayerReportProps {
  metrics: SessionMetrics;
  scores: ComputedScores;
  report: FullReport;
  playerView: PlayerViewType;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 80) return '#4ecdc4';
  if (score >= 60) return '#f39c12';
  return '#ff6b6b';
}

function energyIcon(label: string) {
  if (label === 'STRONG') return '✔';
  if (label === 'OK') return '•';
  return '✖';
}

function energyColor(label: string): string {
  if (label === 'STRONG') return '#4ecdc4';
  if (label === 'OK') return '#f39c12';
  return '#ff6b6b';
}

// ─── Player View ────────────────────────────────────────────────────────────

function PlayerViewTab({ playerView, scores }: { playerView: PlayerViewType; scores: ComputedScores }) {
  return (
    <div className="space-y-8">
      {/* Section 1: YOUR SWING STORY */}
      <section>
        <h2 className="text-2xl font-bold text-white mb-4">Your Swing Story</h2>
        <div className="space-y-3">
          {[
            { label: 'BASE', color: '#3498db', text: playerView.storyBullets.base },
            { label: 'RHYTHM', color: '#9b59b6', text: playerView.storyBullets.rhythm },
            { label: 'BARREL', color: '#e67e22', text: playerView.storyBullets.barrel },
          ].map((row) => (
            <div key={row.label} className="flex items-start gap-3">
              <span
                className="shrink-0 px-2.5 py-0.5 rounded text-xs font-bold text-white mt-0.5"
                style={{ backgroundColor: row.color }}
              >
                {row.label}
              </span>
              <p className="text-slate-300 text-sm leading-relaxed">{row.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Section 2: YOUR TARGETS */}
      <section>
        <h3 className="text-lg font-semibold text-white mb-3">Your Targets</h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Platform', value: playerView.targets.platformScore, suffix: '' },
            { label: 'Swing Window', value: playerView.targets.swingWindowScore, suffix: '' },
            { label: 'EV Floor', value: playerView.targets.evFloor, suffix: ' mph' },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-xl bg-slate-800/80 border border-slate-700/50 p-4 text-center"
            >
              <p className="text-xs text-slate-400 mb-1">{card.label}</p>
              <p
                className="text-3xl font-bold"
                style={{ color: scoreColor(card.value) }}
              >
                {Math.round(card.value)}
                <span className="text-sm font-normal text-slate-500">{card.suffix}</span>
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Section 3: ENERGY FLOW */}
      <section>
        <h3 className="text-lg font-semibold text-white mb-3">Energy Flow</h3>
        <div className="space-y-2">
          {[
            { from: 'HIP', to: 'BODY', label: playerView.energyFlow.hipToBody },
            { from: 'BODY', to: 'ARMS', label: playerView.energyFlow.bodyToArms },
            { from: 'ARMS', to: 'BARREL', label: playerView.energyFlow.armsToBarrel },
          ].map((row) => (
            <div
              key={row.from}
              className="flex items-center justify-between rounded-lg bg-slate-800/60 border border-slate-700/40 px-4 py-3"
            >
              <span className="text-sm text-slate-300">
                {row.from} → {row.to}
              </span>
              <span
                className="flex items-center gap-2 text-sm font-semibold"
                style={{ color: energyColor(row.label) }}
              >
                <span className="text-lg">{energyIcon(row.label)}</span>
                {row.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Section 4: SWING RHYTHM */}
      <section className="text-center">
        <h3 className="text-lg font-semibold text-white mb-2">Swing Rhythm</h3>
        <p className="text-3xl font-mono font-bold text-white tracking-wider">
          {playerView.beat.label}
        </p>
      </section>

      {/* Section 5: WHAT WE'RE BUILDING */}
      <section>
        <h3 className="text-lg font-semibold text-white mb-3">What We're Building</h3>
        <ul className="space-y-2">
          {playerView.whatWereBuilding.map((bullet, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
              <span className="text-[#E63946] mt-0.5 shrink-0">▸</span>
              {bullet}
            </li>
          ))}
        </ul>
      </section>

      {/* Section 6: TWO DRILLS */}
      <section>
        <h3 className="text-lg font-semibold text-white mb-3">Your Drills</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {playerView.drills.map((drill, i) => (
            <div
              key={i}
              className="rounded-xl bg-slate-800/80 border border-slate-700/50 p-4"
            >
              <p className="text-sm font-bold mb-2" style={{ color: '#4ecdc4' }}>
                {drill.title}
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">{drill.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Section 7: DETAIL SECTIONS */}
      <section className="space-y-4">
        {[
          { label: 'BASE', data: playerView.sections.base },
          { label: 'RHYTHM', data: playerView.sections.rhythm },
          { label: 'BARREL', data: playerView.sections.barrel },
          { label: 'BALL', data: playerView.sections.ball },
        ].map((sec) => (
          <div key={sec.label} className="rounded-xl bg-slate-800/60 border border-slate-700/40 p-4">
            <p className="text-xs font-bold text-slate-500 mb-2">{sec.label}</p>
            <p className="text-sm text-slate-300 mb-3">{sec.data.insight}</p>
            <div className="border-l-2 border-[#E63946] pl-3">
              <p className="text-sm text-slate-200">{sec.data.recommendation}</p>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

// ─── Coach View ─────────────────────────────────────────────────────────────

function CoachViewTab({
  scores,
  report,
  metrics,
}: {
  scores: ComputedScores;
  report: FullReport;
  metrics: SessionMetrics;
}) {
  return (
    <div className="space-y-8">
      {/* 4B Score Tiles */}
      <section>
        <h3 className="text-lg font-semibold text-white mb-3">4B Scores</h3>
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'BODY', value: scores.bodyScore },
            { label: 'BRAIN', value: scores.brainScore },
            { label: 'BAT', value: scores.batScore },
            { label: 'BALL', value: scores.ballScore },
          ].map((tile) => (
            <div key={tile.label} className="rounded-lg bg-slate-800 border border-slate-700/50 p-3 text-center">
              <p className="text-[10px] font-bold text-slate-500">{tile.label}</p>
              <p className="text-2xl font-bold" style={{ color: scoreColor(tile.value) }}>
                {tile.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Archetype + Root Cause */}
      <section className="rounded-xl bg-slate-800/80 border border-slate-700/50 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-500">Archetype</span>
          <span className="text-sm font-bold text-white">{report.archetype}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Root Issue</span>
          <span className="text-sm font-semibold text-[#E63946]">{report.rootIssue}</span>
        </div>
      </section>

      {/* Energy Flow with ratios */}
      <section>
        <h3 className="text-lg font-semibold text-white mb-3">Energy Flow</h3>
        <div className="space-y-2">
          {[
            { from: 'HIP → BODY', gain: metrics.pelvis_torso_gain },
            { from: 'BODY → ARMS', gain: metrics.torso_arm_gain },
            { from: 'ARMS → BARREL', gain: metrics.arm_bat_gain },
          ].map((row) => {
            const label = row.gain >= 1.3 ? 'STRONG' : row.gain >= 1.0 ? 'OK' : 'LOSING';
            return (
              <div
                key={row.from}
                className="flex items-center justify-between rounded-lg bg-slate-800/60 border border-slate-700/40 px-4 py-3"
              >
                <span className="text-sm text-slate-300">{row.from}</span>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">{row.gain.toFixed(2)}×</span>
                  <span className="text-sm font-semibold" style={{ color: energyColor(label) }}>
                    {label}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Window Scores */}
      <section>
        <h3 className="text-lg font-semibold text-white mb-3">Window Scores</h3>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Platform', value: scores.platformScore },
            { label: 'Timing', value: scores.windowTimingScore },
            { label: 'Space', value: scores.windowSpaceScore },
          ].map((s) => (
            <div key={s.label} className="rounded-lg bg-slate-800 border border-slate-700/50 p-3 text-center">
              <p className="text-[10px] font-bold text-slate-500">{s.label}</p>
              <p className="text-xl font-bold" style={{ color: scoreColor(s.value) }}>{s.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Raw Metrics */}
      <section>
        <h3 className="text-lg font-semibold text-white mb-3">Raw Metrics</h3>
        <div className="rounded-xl bg-slate-800/80 border border-slate-700/50 divide-y divide-slate-700/40">
          {[
            { label: 'COM Drift', value: `${metrics.com_drift_inches.toFixed(1)} in` },
            { label: 'COM Velocity', value: `${metrics.com_velocity_mps.toFixed(2)} m/s` },
            { label: 'Pelvis Peak', value: `${metrics.pelvis_peak_deg_s.toFixed(0)} °/s` },
            { label: 'Trunk CV', value: `${metrics.trunk_variability_cv.toFixed(1)}%` },
            { label: 'Frontal Δ', value: `${metrics.trunk_frontal_change_deg.toFixed(1)}°` },
            { label: 'Lateral Δ', value: `${metrics.trunk_lateral_change_deg.toFixed(1)}°` },
            { label: 'Pelvis-Torso Gap', value: `${metrics.pelvis_torso_gap_ms.toFixed(1)} ms` },
            { label: 'Arm CV', value: `${metrics.arm_variability_cv.toFixed(1)}%` },
            { label: 'EV Max', value: `${metrics.exit_velocity_max.toFixed(1)} mph` },
            { label: 'EV Min', value: `${metrics.exit_velocity_min.toFixed(1)} mph` },
            { label: 'EV Gap', value: `${scores.evGap.toFixed(1)} mph` },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-xs text-slate-400">{row.label}</span>
              <span className="text-sm font-mono text-white">{row.value}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function PlayerReport({ metrics, scores, report, playerView }: PlayerReportProps) {
  const [view, setView] = useState<'player' | 'coach'>('player');

  return (
    <div className="max-w-lg mx-auto">
      {/* Toggle */}
      <div className="flex gap-1 mb-6 bg-slate-800/80 rounded-lg p-1">
        <button
          onClick={() => setView('player')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-semibold transition-all ${
            view === 'player'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Player View
        </button>
        <button
          onClick={() => setView('coach')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-semibold transition-all ${
            view === 'coach'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Coach View
        </button>
      </div>

      {view === 'player' ? (
        <PlayerViewTab playerView={playerView} scores={scores} />
      ) : (
        <CoachViewTab scores={scores} report={report} metrics={metrics} />
      )}
    </div>
  );
}
