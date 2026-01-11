/**
 * Training Swing Visualizer
 * ==========================
 * A stick-figure skeleton visualizer that highlights the cause of energy leaks.
 * 
 * VISUAL STYLE:
 * - Side-view stick figure
 * - Dark background
 * - Light gray skeleton
 * - StatCast-inspired minimal aesthetic
 * 
 * COLOR RULES:
 * - Green → on-time / good
 * - Yellow → late / partial issue
 * - Red → cause of energy loss
 * - Gray → inactive / neutral
 * 
 * RULES:
 * - Only legs/feet may be red or yellow
 * - Pelvis is never red by itself
 * - Visualizer explains WHY, not HOW
 */

import { useEffect, useState, useCallback } from 'react';
import { LeakType } from '@/lib/reboot-parser';
import { 
  TrainingTranslation, 
  getTrainingTranslation, 
  hasConfidentAnalysis,
  getBodyPartDisplayName 
} from '@/lib/training-translation';
import { AlertTriangle, CheckCircle2, Zap } from 'lucide-react';

interface TrainingSwingVisualizerProps {
  leakType: LeakType;
  swingCount?: number;
  hasContactEvent?: boolean;
  className?: string;
}

// Skeleton joint positions for side-view swing (at leak moment / freeze frame)
const SKELETON_POSITIONS = {
  // Head
  head: { x: 155, y: 40 },
  
  // Spine
  neck: { x: 150, y: 60 },
  core: { x: 145, y: 100 },
  pelvis: { x: 140, y: 130 },
  
  // Lead leg (front)
  lead_hip: { x: 150, y: 135 },
  lead_knee: { x: 155, y: 175 },
  lead_ankle: { x: 160, y: 215 },
  lead_foot: { x: 175, y: 218 },
  
  // Rear leg (back)
  rear_hip: { x: 130, y: 135 },
  rear_knee: { x: 115, y: 170 },
  rear_ankle: { x: 100, y: 210 },
  rear_foot: { x: 85, y: 213 },
  
  // Lead arm (front)
  lead_shoulder: { x: 160, y: 68 },
  lead_elbow: { x: 180, y: 85 },
  lead_wrist: { x: 195, y: 70 },
  
  // Rear arm (back) 
  rear_shoulder: { x: 140, y: 68 },
  rear_elbow: { x: 120, y: 80 },
  rear_wrist: { x: 135, y: 55 },
  
  // Bat (simplified)
  bat_end: { x: 220, y: 50 },
};

// Skeleton bone connections
const BONES = [
  // Spine
  { from: 'head', to: 'neck' },
  { from: 'neck', to: 'core' },
  { from: 'core', to: 'pelvis' },
  
  // Lead leg
  { from: 'pelvis', to: 'lead_hip' },
  { from: 'lead_hip', to: 'lead_knee' },
  { from: 'lead_knee', to: 'lead_ankle' },
  { from: 'lead_ankle', to: 'lead_foot' },
  
  // Rear leg
  { from: 'pelvis', to: 'rear_hip' },
  { from: 'rear_hip', to: 'rear_knee' },
  { from: 'rear_knee', to: 'rear_ankle' },
  { from: 'rear_ankle', to: 'rear_foot' },
  
  // Shoulders
  { from: 'neck', to: 'lead_shoulder' },
  { from: 'neck', to: 'rear_shoulder' },
  
  // Lead arm
  { from: 'lead_shoulder', to: 'lead_elbow' },
  { from: 'lead_elbow', to: 'lead_wrist' },
  
  // Rear arm
  { from: 'rear_shoulder', to: 'rear_elbow' },
  { from: 'rear_elbow', to: 'rear_wrist' },
  
  // Bat
  { from: 'rear_wrist', to: 'lead_wrist' },
  { from: 'lead_wrist', to: 'bat_end' },
];

// Joint to highlight mapping - LEGS ONLY for primary highlights
// Pelvis is handled separately as secondary tier (low opacity, never red)
const JOINT_HIGHLIGHT_MAP: Record<string, string[]> = {
  rear_hip: ['rear_hip'],  // No pelvis - legs only
  rear_knee: ['rear_hip', 'rear_knee'],
  rear_ankle: ['rear_knee', 'rear_ankle', 'rear_foot'],
  lead_hip: ['lead_hip'],  // No pelvis - legs only
  lead_knee: ['lead_hip', 'lead_knee'],
  lead_ankle: ['lead_knee', 'lead_ankle', 'lead_foot'],
  core: ['core', 'neck'],  // No pelvis - core only
};

// Secondary highlight joints (shown at low opacity, never red)
const SECONDARY_JOINTS = new Set(['pelvis']);

// Get all joints to highlight based on translation
function getHighlightedJoints(translation: TrainingTranslation): Set<string> {
  const joints = new Set<string>();
  
  for (const joint of translation.highlightJoints) {
    const mappedJoints = JOINT_HIGHLIGHT_MAP[joint] || [];
    mappedJoints.forEach(j => joints.add(j));
  }
  
  return joints;
}

// Check if a joint is secondary (pelvis) - never gets full color
function isSecondaryJoint(joint: string): boolean {
  return SECONDARY_JOINTS.has(joint);
}

// Get color for a bone based on highlighted joints
// Secondary joints (pelvis) get low opacity, never red
function getBoneColor(
  from: string, 
  to: string, 
  highlightedJoints: Set<string>,
  causeColor: 'green' | 'yellow' | 'red'
): string {
  const fromHighlighted = highlightedJoints.has(from);
  const toHighlighted = highlightedJoints.has(to);
  const isHighlighted = fromHighlighted || toHighlighted;
  
  // Check if this bone connects to pelvis
  const connectsToPelvis = isSecondaryJoint(from) || isSecondaryJoint(to);
  
  if (!isHighlighted) {
    // Secondary joints (pelvis) get slightly more opacity as connectors
    if (connectsToPelvis) {
      return 'hsl(var(--muted-foreground) / 0.5)';
    }
    return 'hsl(var(--muted-foreground) / 0.4)';
  }
  
  // If one end is pelvis, use muted color (never full red/yellow)
  if (connectsToPelvis) {
    switch (causeColor) {
      case 'green':
        return 'hsl(142 76% 55% / 0.4)'; // green, low opacity
      case 'yellow':
        return 'hsl(45 93% 58% / 0.4)'; // amber, low opacity
      case 'red':
        return 'hsl(45 93% 58% / 0.4)'; // YELLOW not red for pelvis
      default:
        return 'hsl(var(--muted-foreground) / 0.5)';
    }
  }
  
  switch (causeColor) {
    case 'green':
      return 'hsl(142 76% 55%)'; // green-500
    case 'yellow':
      return 'hsl(45 93% 58%)'; // amber-400
    case 'red':
      return 'hsl(0 84% 60%)'; // red-500
    default:
      return 'hsl(var(--muted-foreground) / 0.4)';
  }
}

// Get color for joint based on highlight status
// Secondary joints (pelvis) get low opacity, never red
function getJointColor(
  joint: string,
  highlightedJoints: Set<string>,
  causeColor: 'green' | 'yellow' | 'red'
): string {
  const isHighlighted = highlightedJoints.has(joint);
  const isSecondary = isSecondaryJoint(joint);
  
  // Pelvis is always shown as secondary (low opacity, never red)
  if (isSecondary) {
    if (isHighlighted || causeColor !== 'green') {
      return 'hsl(var(--muted-foreground) / 0.5)'; // Low opacity connector
    }
    return 'hsl(var(--muted-foreground) / 0.4)';
  }
  
  if (!isHighlighted) {
    return 'hsl(var(--muted-foreground) / 0.3)';
  }
  
  switch (causeColor) {
    case 'green':
      return 'hsl(142 76% 55%)';
    case 'yellow':
      return 'hsl(45 93% 58%)';
    case 'red':
      return 'hsl(0 84% 60%)';
    default:
      return 'hsl(var(--muted-foreground) / 0.3)';
  }
}

export function TrainingSwingVisualizer({
  leakType,
  swingCount = 0,
  hasContactEvent = false,
  className = '',
}: TrainingSwingVisualizerProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [showHighlight, setShowHighlight] = useState(false);
  
  const translation = getTrainingTranslation(leakType);
  const confidence = hasConfidentAnalysis(swingCount, hasContactEvent, leakType);
  const highlightedJoints = getHighlightedJoints(translation);
  
  // Auto-play animation on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsAnimating(true);
      // After brief animation, freeze and highlight
      setTimeout(() => {
        setIsAnimating(false);
        setShowHighlight(true);
      }, 800);
    }, 500);
    
    return () => clearTimeout(timer);
  }, [leakType]);
  
  // Handle replay
  const handleReplay = useCallback(() => {
    setShowHighlight(false);
    setIsAnimating(true);
    setTimeout(() => {
      setIsAnimating(false);
      setShowHighlight(true);
    }, 800);
  }, []);
  
  // Low confidence state
  if (!confidence.confident) {
    return (
      <div className={`bg-slate-900 rounded-xl border border-slate-800 p-6 ${className}`}>
        <div className="flex flex-col items-center justify-center h-48 text-center">
          <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center mb-4">
            <AlertTriangle className="h-6 w-6 text-amber-400" />
          </div>
          <p className="text-amber-400 font-medium mb-1">NEED MORE</p>
          <p className="text-slate-400 text-sm max-w-xs">
            {confidence.message}
          </p>
        </div>
      </div>
    );
  }
  
  // Clean transfer state
  if (leakType === LeakType.CLEAN_TRANSFER) {
    return (
      <div className={`bg-slate-900 rounded-xl border border-green-500/30 p-6 ${className}`}>
        <div className="flex flex-col items-center justify-center h-48 text-center">
          <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
            <CheckCircle2 className="h-6 w-6 text-green-400" />
          </div>
          <p className="text-green-400 font-medium mb-1">GOOD MOVE</p>
          <p className="text-slate-400 text-sm max-w-xs">
            {translation.caption}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-slate-900 rounded-xl border border-slate-800 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-400" />
          <span className="text-sm font-medium text-white">Here's What Broke Down</span>
        </div>
        {showHighlight && (
          <button 
            onClick={handleReplay}
            className="text-xs text-slate-400 hover:text-white transition-colors"
          >
            Run it again
          </button>
        )}
      </div>
      
      {/* Visualizer */}
      <div className="relative">
        {/* Ground line */}
        <svg 
          viewBox="0 0 300 250" 
          className={`w-full h-48 ${isAnimating ? 'animate-pulse' : ''}`}
          style={{ background: 'transparent' }}
        >
          {/* Ground */}
          <line 
            x1="50" y1="220" x2="250" y2="220" 
            stroke="hsl(var(--muted-foreground) / 0.2)" 
            strokeWidth="2"
            strokeDasharray="4 4"
          />
          
          {/* Skeleton bones */}
          {BONES.map((bone, i) => {
            const from = SKELETON_POSITIONS[bone.from as keyof typeof SKELETON_POSITIONS];
            const to = SKELETON_POSITIONS[bone.to as keyof typeof SKELETON_POSITIONS];
            
            if (!from || !to) return null;
            
            const color = showHighlight 
              ? getBoneColor(bone.from, bone.to, highlightedJoints, translation.causeColor)
              : 'hsl(var(--muted-foreground) / 0.4)';
            
            const strokeWidth = showHighlight && 
              (highlightedJoints.has(bone.from) || highlightedJoints.has(bone.to))
              ? 4 
              : 3;
            
            return (
              <line
                key={i}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            );
          })}
          
          {/* Skeleton joints */}
          {Object.entries(SKELETON_POSITIONS).map(([name, pos]) => {
            // Skip bat end and feet for joints
            if (name === 'bat_end' || name.includes('foot')) return null;
            
            const color = showHighlight 
              ? getJointColor(name, highlightedJoints, translation.causeColor)
              : 'hsl(var(--muted-foreground) / 0.3)';
            
            const radius = showHighlight && highlightedJoints.has(name) ? 6 : 4;
            
            return (
              <circle
                key={name}
                cx={pos.x}
                cy={pos.y}
                r={radius}
                fill={color}
                className="transition-all duration-500"
              />
            );
          })}
          
          {/* Head */}
          <circle
            cx={SKELETON_POSITIONS.head.x}
            cy={SKELETON_POSITIONS.head.y}
            r="12"
            fill="none"
            stroke="hsl(var(--muted-foreground) / 0.4)"
            strokeWidth="3"
          />
          
          {/* Freeze indicator */}
          {showHighlight && translation.primaryCause !== 'none' && (
            <g>
              {/* Pulse ring around issue area */}
              <circle
                cx={translation.primaryCause === 'rear_leg' ? 115 : 155}
                cy={175}
                r="30"
                fill="none"
                stroke={translation.causeColor === 'red' ? 'hsl(0 84% 60% / 0.3)' : 'hsl(45 93% 58% / 0.3)'}
                strokeWidth="2"
                className="animate-ping"
              />
            </g>
          )}
        </svg>
        
        {/* Cause badge */}
        {showHighlight && translation.primaryCause !== 'none' && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
            <span 
              className={`
                inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium
                ${translation.causeColor === 'red' 
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                  : translation.causeColor === 'yellow'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-green-500/20 text-green-400 border border-green-500/30'
                }
              `}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${
                translation.causeColor === 'red' ? 'bg-red-400' :
                translation.causeColor === 'yellow' ? 'bg-amber-400' : 'bg-green-400'
              }`} />
              {getBodyPartDisplayName(translation.primaryCause)}
            </span>
          </div>
        )}
      </div>
      
      {/* Caption */}
      <div className="p-4 border-t border-slate-800">
        <p className="text-white text-center font-medium mb-1">
          {translation.caption}
        </p>
        <p className="text-slate-400 text-center text-sm">
          <span className="text-slate-500">Training Focus:</span> {translation.trainingFocus}
        </p>
      </div>
      
      {/* Clarifying label */}
      <div className="px-4 pb-3">
        <p className="text-slate-500 text-center text-xs italic">
          Training diagram — shows the pattern, not a full replay.
        </p>
      </div>
    </div>
  );
}
