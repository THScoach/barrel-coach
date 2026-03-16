/**
 * Skeleton Data Model & CSV Parser
 * ==================================
 * Parses Reboot Motion IK CSV data into structured frame data
 * and defines the bone topology for 3D rendering.
 */

export interface JointPosition {
  x: number;
  y: number;
  z: number;
}

export interface SkeletonFrame {
  joints: Record<string, JointPosition>;
  time: number;
}

/** Known joint base names extracted from CSV column naming convention */
const KNOWN_JOINTS = [
  'skullbase', 'neck', 'lsjc', 'rsjc', 'lwjc', 'rwjc',
  'midhip', 'lhjc', 'rhjc', 'lkjc', 'rkjc', 'lmmal', 'rmmal',
  'baseball', 'bhandle', 'bhead',
];

export type BoneSide = 'left' | 'right' | 'mid' | 'bat';

export interface BoneDef {
  from: string;
  to: string;
  side: BoneSide;
}

/** Fixed bone topology */
export const BONE_DEFINITIONS: BoneDef[] = [
  // Spine (midline)
  { from: 'midhip', to: 'neck', side: 'mid' },
  { from: 'neck', to: 'skullbase', side: 'mid' },
  // Left arm
  { from: 'neck', to: 'lsjc', side: 'left' },
  { from: 'lsjc', to: 'lwjc', side: 'left' },
  // Right arm
  { from: 'neck', to: 'rsjc', side: 'right' },
  { from: 'rsjc', to: 'rwjc', side: 'right' },
  // Left leg
  { from: 'midhip', to: 'lhjc', side: 'left' },
  { from: 'lhjc', to: 'lkjc', side: 'left' },
  { from: 'lkjc', to: 'lmmal', side: 'left' },
  // Right leg
  { from: 'midhip', to: 'rhjc', side: 'right' },
  { from: 'rhjc', to: 'rkjc', side: 'right' },
  { from: 'rkjc', to: 'rmmal', side: 'right' },
  // Bat (optional — only rendered if joints exist)
  { from: 'bhandle', to: 'bhead', side: 'bat' },
];

/** Color map for bone sides */
export const BONE_COLORS: Record<BoneSide, string> = {
  left: '#3b82f6',   // blue
  right: '#ef4444',  // red
  mid: '#22c55e',    // green
  bat: '#eab308',    // gold
};

export const JOINT_RADIUS = 0.008;

/**
 * Extract unique joint base names from CSV headers.
 * Convention: columns are named like "neckx", "necky", "neckz".
 */
function extractJointNames(headers: string[]): string[] {
  const names = new Set<string>();
  for (const h of headers) {
    const lower = h.trim().toLowerCase();
    for (const j of KNOWN_JOINTS) {
      if (lower === `${j}x` || lower === `${j}y` || lower === `${j}z`) {
        names.add(j);
      }
    }
  }
  return Array.from(names);
}

/**
 * Parse Reboot Motion IK CSV text into an array of SkeletonFrames.
 */
export function parseIKCsv(csvText: string): SkeletonFrame[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const jointNames = extractJointNames(headers);

  // Build column index lookup
  const colIdx: Record<string, number> = {};
  headers.forEach((h, i) => { colIdx[h] = i; });

  // Time column
  const timeCol = colIdx['timeorg'] ?? colIdx['time'] ?? -1;

  const frames: SkeletonFrame[] = [];

  for (let row = 1; row < lines.length; row++) {
    const vals = lines[row].split(',');
    if (vals.length < 3) continue;

    const joints: Record<string, JointPosition> = {};
    for (const jn of jointNames) {
      const xi = colIdx[`${jn}x`];
      const yi = colIdx[`${jn}y`];
      const zi = colIdx[`${jn}z`];
      if (xi !== undefined && yi !== undefined && zi !== undefined) {
        const x = parseFloat(vals[xi]);
        const y = parseFloat(vals[yi]);
        const z = parseFloat(vals[zi]);
        if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
          joints[jn] = { x, y, z };
        }
      }
    }

    const time = timeCol >= 0 ? parseFloat(vals[timeCol]) || 0 : row - 1;
    frames.push({ joints, time });
  }

  return frames;
}

/**
 * Compute median frame delta in seconds, then convert to ms-per-frame.
 */
export function computeMsPerFrame(frames: SkeletonFrame[]): number {
  if (frames.length < 2) return 33; // ~30fps fallback

  const deltas: number[] = [];
  for (let i = 1; i < frames.length; i++) {
    deltas.push(Math.abs(frames[i].time - frames[i - 1].time));
  }
  deltas.sort((a, b) => a - b);
  const median = deltas[Math.floor(deltas.length / 2)];

  // If median is very small assume it's already seconds; convert to ms
  const ms = median < 1 ? median * 1000 : median;
  return Math.max(ms, 1); // floor at 1ms
}

/**
 * Filter bone definitions to only those whose joints exist in data.
 */
export function getAvailableBones(frame: SkeletonFrame): BoneDef[] {
  return BONE_DEFINITIONS.filter(
    b => frame.joints[b.from] && frame.joints[b.to]
  );
}
