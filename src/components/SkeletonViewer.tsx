/**
 * SkeletonViewer
 * ===============
 * Three.js stick-figure skeleton visualizer for Reboot Motion IK data.
 * Renders color-coded bones with play/pause, scrubber, and speed controls.
 */

import { useMemo, useRef } from 'react';
import { Canvas, extend } from '@react-three/fiber';
import { OrbitControls, Line } from '@react-three/drei';
import * as THREE from 'three';
import { 
  SkeletonFrame, 
  BoneDef, 
  BONE_COLORS, 
  JOINT_RADIUS,
  getAvailableBones, 
  parseIKCsv,
} from '@/lib/skeleton-data';
import { useSkeletonPlayer } from '@/hooks/useSkeletonPlayer';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, RotateCcw } from 'lucide-react';

// ─── Props ──────────────────────────────────────────────────────────────

interface SkeletonViewerProps {
  /** Raw CSV text – will be parsed internally */
  csvData?: string;
  /** Pre-parsed frames – takes precedence over csvData */
  frames?: SkeletonFrame[];
  /** Initial playback speed multiplier (default 0.25) */
  playbackSpeed?: number;
  className?: string;
}

// ─── Three.js sub-components ────────────────────────────────────────────

interface SkeletonBonesProps {
  frame: SkeletonFrame;
  bones: BoneDef[];
}

/** Renders all bones as colored lines + joint spheres for a single frame */
function SkeletonBones({ frame, bones }: SkeletonBonesProps) {
  const linesRef = useRef<THREE.Group>(null);

  // Pre-create materials
  const materials = useMemo(() => {
    const m: Record<string, THREE.LineBasicMaterial> = {};
    for (const [side, color] of Object.entries(BONE_COLORS)) {
      m[side] = new THREE.LineBasicMaterial({ color, linewidth: 2 });
    }
    return m;
  }, []);

  const jointMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#e2e8f0' }),
    []
  );
  const jointGeometry = useMemo(
    () => new THREE.SphereGeometry(JOINT_RADIUS, 8, 6),
    []
  );

  // Rebuild geometry every frame change
  const elements = useMemo(() => {
    const items: JSX.Element[] = [];
    const renderedJoints = new Set<string>();

    bones.forEach((bone, i) => {
      const a = frame.joints[bone.from];
      const b = frame.joints[bone.to];
      if (!a || !b) return;

      // Line via drei <Line> to avoid SVG conflict
      const points: [number, number, number][] = [
        [a.x, a.z, -a.y],
        [b.x, b.z, -b.y],
      ];

      items.push(
        <Line
          key={`bone-${i}`}
          points={points}
          color={BONE_COLORS[bone.side]}
          lineWidth={2}
        />
      );

      // Joint spheres (deduplicated)
      for (const jn of [bone.from, bone.to]) {
        if (renderedJoints.has(jn)) continue;
        renderedJoints.add(jn);
        const j = frame.joints[jn];
        if (!j) continue;
        items.push(
          <mesh
            key={`joint-${jn}`}
            position={[j.x, j.z, -j.y]}
            geometry={jointGeometry}
            material={jointMaterial}
          />
        );
      }
    });

    return items;
  }, [frame, bones, jointGeometry, jointMaterial]);

  return <group ref={linesRef}>{elements}</group>;
}

/** Grid helper and lighting */
function SceneSetup() {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 10, 5]} intensity={0.8} />
      <gridHelper args={[2, 20, '#334155', '#1e293b']} position={[0, -0.01, 0]} />
    </>
  );
}

// ─── Speed presets ──────────────────────────────────────────────────────

const SPEED_PRESETS = [0.1, 0.25, 0.5, 1.0];

// ─── Main Component ─────────────────────────────────────────────────────

export function SkeletonViewer({
  csvData,
  frames: framesProp,
  playbackSpeed = 0.25,
  className = '',
}: SkeletonViewerProps) {
  // Parse data
  const frames = useMemo(() => {
    if (framesProp && framesProp.length > 0) return framesProp;
    if (csvData) return parseIKCsv(csvData);
    return [];
  }, [csvData, framesProp]);

  const player = useSkeletonPlayer(frames, playbackSpeed);

  // Available bones from first frame
  const bones = useMemo(
    () => (frames.length > 0 ? getAvailableBones(frames[0]) : []),
    [frames]
  );

  const currentFrameData = frames[player.currentFrame] ?? frames[0];

  if (frames.length === 0) {
    return (
      <div className={`bg-slate-900 rounded-xl border border-slate-800 p-8 flex items-center justify-center h-64 ${className}`}>
        <p className="text-slate-400 text-sm">No skeleton data loaded</p>
      </div>
    );
  }

  return (
    <div className={`bg-slate-900 rounded-xl border border-slate-800 overflow-hidden flex flex-col ${className}`}>
      {/* Header */}
      <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-300 tracking-wide uppercase">
          3D Skeleton
        </span>
        <span className="text-xs text-slate-500 font-mono">
          Frame {player.currentFrame + 1} / {player.duration}
        </span>
      </div>

      {/* Canvas */}
      <div className="relative flex-1 min-h-[320px]">
        <Canvas
          camera={{ position: [1.2, 1.0, 1.2], fov: 45, near: 0.01, far: 50 }}
          style={{ background: '#0f172a' }}
        >
          <SceneSetup />
          {currentFrameData && (
            <SkeletonBones frame={currentFrameData} bones={bones} />
          )}
          <OrbitControls
            enablePan
            enableZoom
            enableRotate
            minDistance={0.3}
            maxDistance={5}
          />
        </Canvas>
      </div>

      {/* Controls */}
      <div className="px-4 py-3 border-t border-slate-800 space-y-2">
        {/* Scrubber */}
        <Slider
          value={[player.currentFrame]}
          min={0}
          max={Math.max(player.duration - 1, 0)}
          step={1}
          onValueChange={([v]) => player.seek(v)}
          className="w-full"
        />

        {/* Buttons row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Play / Pause */}
            <button
              onClick={player.toggle}
              className="h-8 w-8 rounded-md bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-white transition-colors"
              aria-label={player.isPlaying ? 'Pause' : 'Play'}
            >
              {player.isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </button>

            {/* Reset */}
            <button
              onClick={() => { player.pause(); player.seek(0); }}
              className="h-8 w-8 rounded-md bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-white transition-colors"
              aria-label="Reset"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Speed toggles */}
          <div className="flex items-center gap-1">
            {SPEED_PRESETS.map(s => (
              <button
                key={s}
                onClick={() => player.setPlaybackSpeed(s)}
                className={`px-2 py-1 rounded text-xs font-mono transition-colors ${
                  player.playbackSpeed === s
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 pt-1">
          {Object.entries(BONE_COLORS).map(([side, color]) => (
            <div key={side} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
              <span className="text-[10px] text-slate-500 capitalize">{side}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SkeletonViewer;
