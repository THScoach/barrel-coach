/**
 * MLB Comparison Card - Section 7
 * Player vs MLB match comparison
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Trophy, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import type { MLBComparison, MotorProfileType } from '@/lib/lab-report-types';
import type { KineticFingerprintResult, ComponentScore } from '@/lib/kinetic-fingerprint-score';

interface MLBComparisonCardProps {
  playerKfScore: KineticFingerprintResult;
  mlbMatch: MLBComparison;
  playerProfile?: MotorProfileType;
  // MLB benchmark values (ideally fetched from a database)
  mlbBenchmarks?: {
    transfer_ratio: string;
    timing_gap: string;
    deceleration: string;
    energy_delivery: string;
    x_factor: string;
  };
}

// Default MLB elite benchmarks
const DEFAULT_MLB_BENCHMARKS = {
  transfer_ratio: '1.65',
  timing_gap: '16%',
  deceleration: '3/3',
  energy_delivery: '48%',
  x_factor: '55°'
};

function GapDisplay({ playerValue, mlbValue, unit = '' }: { playerValue: string; mlbValue: string; unit?: string }) {
  // Parse numeric values for comparison
  const playerNum = parseFloat(playerValue.replace(/[^0-9.-]/g, ''));
  const mlbNum = parseFloat(mlbValue.replace(/[^0-9.-]/g, ''));
  const diff = playerNum - mlbNum;
  
  if (Math.abs(diff) < 0.1) {
    return (
      <span className="text-teal-400 flex items-center gap-1">
        <Minus className="h-3 w-3" />
        Match
      </span>
    );
  }
  
  const isPositive = diff > 0;
  const Icon = isPositive ? ArrowUp : ArrowDown;
  const colorClass = Math.abs(diff) > 5 ? 'text-red-400' : 'text-orange-400';
  
  return (
    <span className={cn('flex items-center gap-1', colorClass)}>
      <Icon className="h-3 w-3" />
      {isPositive ? '+' : ''}{diff.toFixed(1)}{unit}
    </span>
  );
}

function ComparisonRow({ 
  metric, 
  playerValue, 
  mlbValue 
}: { 
  metric: string; 
  playerValue: string; 
  mlbValue: string;
}) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-slate-800 last:border-0">
      <span className="text-sm text-slate-400">{metric}</span>
      <div className="flex items-center gap-4 text-sm">
        <span className="text-white tabular-nums w-16 text-right">{playerValue}</span>
        <span className="text-slate-500 tabular-nums w-16 text-right">{mlbValue}</span>
        <span className="w-20 text-right">
          <GapDisplay playerValue={playerValue} mlbValue={mlbValue} />
        </span>
      </div>
    </div>
  );
}

export function MLBComparisonCard({ 
  playerKfScore, 
  mlbMatch, 
  playerProfile,
  mlbBenchmarks = DEFAULT_MLB_BENCHMARKS 
}: MLBComparisonCardProps) {
  const { components } = playerKfScore;
  
  // Identify what's similar vs different
  const similarities: string[] = [];
  const differences: string[] = [];
  
  // Check each component
  const checkComponent = (name: string, score: number) => {
    if (score >= 80) {
      similarities.push(name);
    } else if (score < 60) {
      differences.push(name);
    }
  };
  
  checkComponent('Transfer Ratio', components.transfer_ratio.score);
  checkComponent('Timing Gap', components.timing_gap.score);
  checkComponent('Deceleration', components.deceleration.score);
  checkComponent('Sequence Order', components.sequence_order.score);
  checkComponent('Energy Delivery', components.energy_delivery.score);
  checkComponent('X-Factor', components.x_factor.score);
  
  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          YOU vs {mlbMatch.player_name.toUpperCase()}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Match info */}
        <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
          <div>
            <p className="text-sm text-slate-400">MLB Match</p>
            <p className="text-lg font-semibold text-white">{mlbMatch.player_name}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-400">Similarity</p>
            <p className="text-lg font-semibold text-teal-400">{mlbMatch.similarity_score}%</p>
          </div>
        </div>
        
        {/* Comparison Table */}
        <div>
          <div className="flex justify-between items-center py-2 text-xs text-slate-500 border-b border-slate-700">
            <span>METRIC</span>
            <div className="flex items-center gap-4">
              <span className="w-16 text-right">YOU</span>
              <span className="w-16 text-right">{mlbMatch.player_name.split(' ')[1] || 'MLB'}</span>
              <span className="w-20 text-right">GAP</span>
            </div>
          </div>
          
          <ComparisonRow 
            metric="Transfer Ratio"
            playerValue={components.transfer_ratio.value}
            mlbValue={mlbBenchmarks.transfer_ratio}
          />
          <ComparisonRow 
            metric="Timing Gap"
            playerValue={components.timing_gap.value}
            mlbValue={mlbBenchmarks.timing_gap}
          />
          <ComparisonRow 
            metric="Deceleration"
            playerValue={components.deceleration.value}
            mlbValue={mlbBenchmarks.deceleration}
          />
          <ComparisonRow 
            metric="Energy Delivery"
            playerValue={components.energy_delivery.value}
            mlbValue={mlbBenchmarks.energy_delivery}
          />
          <ComparisonRow 
            metric="X-Factor"
            playerValue={components.x_factor.value}
            mlbValue={mlbBenchmarks.x_factor}
          />
        </div>
        
        {/* Insights */}
        <div className="space-y-3 pt-4 border-t border-slate-800">
          {similarities.length > 0 && (
            <div>
              <p className="text-xs text-teal-400 font-medium mb-1">✓ WHAT'S SIMILAR:</p>
              <p className="text-sm text-slate-300">
                Your {similarities.join(' and ')} {similarities.length === 1 ? 'is' : 'are'} already at pro-level. 
                This is your foundation.
              </p>
            </div>
          )}
          
          {differences.length > 0 && (
            <div>
              <p className="text-xs text-orange-400 font-medium mb-1">⚠ WHAT'S DIFFERENT:</p>
              <p className="text-sm text-slate-300">
                Your {differences.join(' and ')} {differences.length === 1 ? 'needs' : 'need'} work. 
                This is where your potential is hiding.
              </p>
            </div>
          )}
          
          <div>
            <p className="text-xs text-slate-500 font-medium mb-1">THE GAP:</p>
            <p className="text-sm text-slate-400">
              You're {mlbMatch.similarity_score}% similar to {mlbMatch.player_name}. 
              {mlbMatch.similarity_score >= 80 
                ? " You're close. Small refinements unlock big gains."
                : mlbMatch.similarity_score >= 60
                  ? " Clear path forward. Focus on the weak links."
                  : " Work to do, but the pattern is there. Trust the process."}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
