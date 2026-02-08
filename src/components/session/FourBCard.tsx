import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { MetricRow } from "./MetricRow";
import type { ReactNode } from "react";

interface FourBMetric {
  label: string;
  value: string | number | null | undefined;
  unit?: string;
}

interface FourBCardProps {
  icon: ReactNode;
  title: string;
  score: number | null | undefined;
  iconColor: string;
  metrics: FourBMetric[];
  footer?: string;
}

function getScoreColor(score: number | null | undefined): string {
  if (score == null) return "text-slate-600";
  if (score >= 70) return "text-green-400";
  if (score >= 50) return "text-yellow-400";
  if (score >= 30) return "text-orange-400";
  return "text-red-400";
}

function getScoreLabel(score: number | null | undefined): string {
  if (score == null) return "—";
  if (score >= 70) return "Strong";
  if (score >= 50) return "Above Avg";
  if (score >= 30) return "Below Avg";
  return "Needs Work";
}

export function FourBCard({
  icon,
  title,
  score,
  iconColor,
  metrics,
  footer,
}: FourBCardProps) {
  return (
    <Card className="bg-slate-900/80 border-slate-800 hover:border-slate-700 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={iconColor}>{icon}</div>
            <h2 className="text-lg font-bold text-white">{title}</h2>
          </div>
          <div className="text-right">
            <p className={`text-2xl font-black ${getScoreColor(score)}`}>
              {score != null ? score : "—"}
            </p>
            <p className={`text-xs ${getScoreColor(score)}`}>
              {getScoreLabel(score)}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-0">
          {metrics.map((m) => (
            <MetricRow
              key={m.label}
              label={m.label}
              value={m.value}
              unit={m.unit}
            />
          ))}
        </div>
        {footer && (
          <p className="text-xs text-slate-500 mt-3 italic">{footer}</p>
        )}
      </CardContent>
    </Card>
  );
}
