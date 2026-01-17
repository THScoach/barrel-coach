/**
 * SWING ANALYSIS COMPARISON VIEW
 * 
 * Shows side-by-side 2D (MediaPipe) vs 3D (Reboot) analysis
 * when both data sources are available for a swing.
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { 
  Camera, 
  Box,
  CheckCircle2,
  ArrowRight,
  Scale,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricComparison {
  name: string;
  label: string;
  value2D: number | null;
  value3D: number | null;
  score2D: number | null;
  score3D: number | null;
  unit: string;
}

interface SwingAnalysisComparisonProps {
  swingId: string;
  swingIndex: number;
  analysis2D: any | null;
  analysis3D: any | null;
  selectedSource: '2d' | '3d' | 'auto';
  onSourceChange: (source: '2d' | '3d' | 'auto') => void;
  onConfirm: () => void;
}

export function SwingAnalysisComparison({
  swingId,
  swingIndex,
  analysis2D,
  analysis3D,
  selectedSource,
  onSourceChange,
  onConfirm,
}: SwingAnalysisComparisonProps) {
  const has2D = !!analysis2D;
  const has3D = !!analysis3D;

  // Build comparison metrics
  const metrics: MetricComparison[] = [
    {
      name: 'load_sequence',
      label: 'Load Sequence',
      value2D: analysis2D?.load_sequence_ms ?? null,
      value3D: analysis3D?.pelvisTiming ?? null,
      score2D: analysis2D?.load_sequence_score ?? null,
      score3D: analysis3D?.scores?.timing ?? null,
      unit: 'ms',
    },
    {
      name: 'tempo',
      label: 'Tempo Ratio',
      value2D: analysis2D?.tempo_ratio ?? null,
      value3D: null, // Not directly available from 3D
      score2D: analysis2D?.tempo_score ?? null,
      score3D: null,
      unit: ':1',
    },
    {
      name: 'separation',
      label: 'Separation',
      value2D: analysis2D?.separation_degrees ?? null,
      value3D: analysis3D?.xFactor ?? null,
      score2D: analysis2D?.separation_score ?? null,
      score3D: analysis3D?.scores?.separation ?? null,
      unit: '°',
    },
    {
      name: 'lead_leg_braking',
      label: 'Lead Leg Braking',
      value2D: analysis2D?.lead_leg_braking_ms ?? null,
      value3D: analysis3D?.leadKneeAtContact ?? null,
      score2D: analysis2D?.lead_leg_braking_score ?? null,
      score3D: null,
      unit: analysis2D?.lead_leg_braking_ms !== null ? 'ms' : '°',
    },
    {
      name: 'body_score',
      label: 'BODY Score',
      value2D: null,
      value3D: null,
      score2D: analysis2D?.body_score ?? null,
      score3D: analysis3D?.body ?? null,
      unit: '',
    },
    {
      name: 'brain_score',
      label: 'BRAIN Score',
      value2D: null,
      value3D: null,
      score2D: analysis2D?.brain_score ?? null,
      score3D: analysis3D?.brain ?? null,
      unit: '',
    },
  ];

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-muted-foreground';
    if (score >= 70) return 'text-green-400';
    if (score >= 55) return 'text-yellow-400';
    if (score >= 45) return 'text-orange-400';
    return 'text-red-400';
  };

  const formatValue = (value: number | null, unit: string) => {
    if (value === null) return '—';
    if (unit === ':1') return `${value.toFixed(1)}${unit}`;
    return `${Math.round(value)}${unit}`;
  };

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Scale className="h-4 w-4 text-primary" />
            Analysis Comparison: Swing {swingIndex + 1}
          </CardTitle>
          <div className="flex items-center gap-2">
            {has2D && (
              <Badge variant="outline" className="text-xs border-blue-500/50 text-blue-400">
                <Camera className="h-3 w-3 mr-1" />
                2D
              </Badge>
            )}
            {has3D && (
              <Badge variant="outline" className="text-xs border-green-500/50 text-green-400">
                <Box className="h-3 w-3 mr-1" />
                3D
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Metrics Comparison Table */}
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left p-2 font-medium">Metric</th>
                <th className="text-center p-2 font-medium">
                  <div className="flex items-center justify-center gap-1">
                    <Camera className="h-3 w-3 text-blue-400" />
                    <span>2D</span>
                  </div>
                </th>
                <th className="text-center p-2 font-medium">
                  <div className="flex items-center justify-center gap-1">
                    <Box className="h-3 w-3 text-green-400" />
                    <span>3D</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((metric) => (
                <tr key={metric.name} className="border-t border-border/50">
                  <td className="p-2 text-muted-foreground">{metric.label}</td>
                  <td className="p-2 text-center">
                    {metric.score2D !== null ? (
                      <div className="flex flex-col items-center">
                        <span className={cn("font-medium", getScoreColor(metric.score2D))}>
                          {metric.score2D}
                        </span>
                        {metric.value2D !== null && (
                          <span className="text-xs text-muted-foreground">
                            {formatValue(metric.value2D, metric.unit)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                  <td className="p-2 text-center">
                    {metric.score3D !== null ? (
                      <div className="flex flex-col items-center">
                        <span className={cn("font-medium", getScoreColor(metric.score3D))}>
                          {metric.score3D}
                        </span>
                        {metric.value3D !== null && (
                          <span className="text-xs text-muted-foreground">
                            {formatValue(metric.value3D, metric.unit)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Source Selection */}
        {has2D && has3D && (
          <div className="space-y-3">
            <Label className="text-sm font-medium">Use for Report</Label>
            <RadioGroup
              value={selectedSource}
              onValueChange={(v) => onSourceChange(v as '2d' | '3d' | 'auto')}
              className="grid grid-cols-3 gap-2"
            >
              <Label
                htmlFor="source-auto"
                className={cn(
                  "flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors",
                  selectedSource === 'auto' ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                )}
              >
                <RadioGroupItem value="auto" id="source-auto" className="sr-only" />
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm">Auto (3D)</span>
              </Label>
              <Label
                htmlFor="source-3d"
                className={cn(
                  "flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors",
                  selectedSource === '3d' ? "border-green-500 bg-green-500/10" : "border-border hover:border-green-500/50"
                )}
              >
                <RadioGroupItem value="3d" id="source-3d" className="sr-only" />
                <Box className="h-4 w-4 text-green-400" />
                <span className="text-sm">3D Only</span>
              </Label>
              <Label
                htmlFor="source-2d"
                className={cn(
                  "flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors",
                  selectedSource === '2d' ? "border-blue-500 bg-blue-500/10" : "border-border hover:border-blue-500/50"
                )}
              >
                <RadioGroupItem value="2d" id="source-2d" className="sr-only" />
                <Camera className="h-4 w-4 text-blue-400" />
                <span className="text-sm">2D Only</span>
              </Label>
            </RadioGroup>

            <div className="flex items-start gap-2 p-2 bg-muted/50 rounded-lg text-xs text-muted-foreground">
              <Info className="h-3 w-3 mt-0.5 shrink-0" />
              <span>
                "Auto" uses 3D when available (more accurate), falls back to 2D for missing metrics.
              </span>
            </div>
          </div>
        )}

        {/* Single Source Info */}
        {has2D && !has3D && (
          <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm">
            <Camera className="h-4 w-4 text-blue-400 mt-0.5" />
            <div>
              <p className="font-medium text-blue-200">2D Analysis Only</p>
              <p className="text-xs text-blue-200/70 mt-0.5">
                Import Reboot 3D data for more accurate biomechanics.
              </p>
            </div>
          </div>
        )}

        {!has2D && has3D && (
          <div className="flex items-start gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-sm">
            <Box className="h-4 w-4 text-green-400 mt-0.5" />
            <div>
              <p className="font-medium text-green-200">3D Analysis Only</p>
              <p className="text-xs text-green-200/70 mt-0.5">
                Full biomechanics data from Reboot Motion.
              </p>
            </div>
          </div>
        )}

        {/* Confirm Button */}
        <Button onClick={onConfirm} className="w-full">
          <ArrowRight className="h-4 w-4 mr-2" />
          Use Selected Source for Report
        </Button>
      </CardContent>
    </Card>
  );
}
