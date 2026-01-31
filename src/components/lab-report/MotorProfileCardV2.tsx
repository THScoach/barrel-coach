/**
 * Motor Profile Card v2.0 - Classification and MLB Match
 * Shows profile type, confidence, characteristics, and pro comparison
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Fingerprint, Target, TrendingUp } from 'lucide-react';
import { MotorProfileSection, MotorProfileType, getMotorProfileColor } from '@/lib/lab-report-types';

interface MotorProfileCardV2Props {
  motorProfile: MotorProfileSection;
}

function getProfileEmoji(profile: MotorProfileType): string {
  switch (profile) {
    case 'SPINNER': return '🌀';
    case 'WHIPPER': return '🏏';
    case 'SLINGSHOTTER': return '🎯';
    case 'TITAN': return '⚡';
  }
}

function getProfileDescription(profile: MotorProfileType): string {
  switch (profile) {
    case 'SPINNER': 
      return "You're built to spin, not slide. Your power comes from quick rotation around your spine — like Altuve wringing out a towel.";
    case 'WHIPPER': 
      return "Your power comes from hip lead and extension. You need to let your hands trail and whip through — violent brake, then release.";
    case 'SLINGSHOTTER': 
      return "You use the ground to create linear force. Load deep, drive forward, and let the barrel sling around.";
    case 'TITAN': 
      return "You have the mass to generate elite power. Focus on sequencing to manage your kinetic chain effectively.";
  }
}

function getConfidenceBadgeColor(confidence: 'confirmed' | 'likely' | 'hint'): string {
  switch (confidence) {
    case 'confirmed': return 'bg-teal-500/20 text-teal-400 border-teal-500/30';
    case 'likely': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'hint': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
  }
}

export function MotorProfileCardV2({ motorProfile }: MotorProfileCardV2Props) {
  if (!motorProfile.present || !motorProfile.profile) return null;

  const profileColor = getMotorProfileColor(motorProfile.profile);
  const confidenceLabel = motorProfile.confidence_label || 'hint';

  return (
    <Card className="bg-slate-900 border-slate-800 overflow-hidden">
      {/* Profile Header with Color Accent */}
      <div 
        className="h-1"
        style={{ backgroundColor: profileColor }}
      />
      
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
            <Fingerprint className="h-4 w-4 text-slate-400" />
            Motor Profile
          </CardTitle>
          <Badge variant="outline" className={getConfidenceBadgeColor(confidenceLabel)}>
            {confidenceLabel === 'confirmed' ? '3D Confirmed' : confidenceLabel === 'likely' ? 'Likely' : 'Hint'}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Profile Display */}
        <div className="bg-slate-800/50 rounded-lg p-4 text-center">
          <div className="text-5xl mb-2">{getProfileEmoji(motorProfile.profile)}</div>
          <div 
            className="text-2xl font-bold"
            style={{ color: profileColor }}
          >
            {motorProfile.profile}
          </div>
          {motorProfile.confidence !== undefined && (
            <div className="text-sm text-slate-500 mt-1">
              {motorProfile.confidence}% confidence
            </div>
          )}
        </div>

        {/* Description */}
        <p className="text-sm text-slate-300 leading-relaxed">
          {motorProfile.summary || getProfileDescription(motorProfile.profile)}
        </p>

        {/* MLB Match */}
        {motorProfile.mlb_match && (
          <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-300">Your MLB Match</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-white">{motorProfile.mlb_match.player_name}</span>
              <span className="text-sm text-teal-400">{motorProfile.mlb_match.similarity_score}% similar</span>
            </div>
            
            {/* Gap to Target */}
            {(motorProfile.mlb_match.gap_transfer_ratio !== undefined || motorProfile.mlb_match.gap_timing !== undefined) && (
              <div className="mt-3 space-y-1 text-xs">
                <div className="text-slate-500 uppercase tracking-wide">Gap to Pro Target</div>
                {motorProfile.mlb_match.gap_transfer_ratio !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Transfer Ratio</span>
                    <span className={motorProfile.mlb_match.gap_transfer_ratio > 0 ? 'text-teal-400' : 'text-orange-400'}>
                      {motorProfile.mlb_match.gap_transfer_ratio > 0 ? '+' : ''}{motorProfile.mlb_match.gap_transfer_ratio.toFixed(2)}
                    </span>
                  </div>
                )}
                {motorProfile.mlb_match.gap_timing !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Timing Gap</span>
                    <span className={motorProfile.mlb_match.gap_timing > 0 ? 'text-teal-400' : 'text-orange-400'}>
                      {motorProfile.mlb_match.gap_timing > 0 ? '+' : ''}{motorProfile.mlb_match.gap_timing.toFixed(0)}%
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Characteristics */}
        {motorProfile.characteristics && motorProfile.characteristics.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs text-slate-500 uppercase tracking-wide">Profile Characteristics</div>
            <ul className="space-y-1">
              {motorProfile.characteristics.map((char, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-slate-300">
                  <span className="text-teal-400 mt-1">•</span>
                  {char}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Training Focus */}
        {motorProfile.training_focus && (
          <div className="bg-slate-800/30 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-3 w-3 text-slate-400" />
              <span className="text-xs text-slate-500 uppercase tracking-wide">Training Focus</span>
            </div>
            <p className="text-sm text-slate-200">{motorProfile.training_focus}</p>
          </div>
        )}

        {/* Profile Legend (Mini) */}
        <div className="flex justify-center gap-2 pt-2">
          {(['SPINNER', 'WHIPPER', 'SLINGSHOTTER', 'TITAN'] as MotorProfileType[]).map((p) => (
            <div
              key={p}
              className={`w-2 h-2 rounded-full ${p === motorProfile.profile ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900' : 'opacity-30'}`}
              style={{ backgroundColor: getMotorProfileColor(p) }}
              title={p}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
