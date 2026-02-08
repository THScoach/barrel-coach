interface MetricRowProps {
  label: string;
  value: string | number | null | undefined;
  unit?: string;
}

export function MetricRow({ label, value, unit }: MetricRowProps) {
  const displayValue = value != null && value !== "" ? value : "—";
  const hasValue = value != null && value !== "" && value !== "—";

  return (
    <div className="flex justify-between items-center py-2 border-b border-slate-800/50 last:border-b-0">
      <span className="text-slate-400 text-sm">{label}</span>
      <span
        className={`font-mono font-semibold text-sm ${
          hasValue ? "text-white" : "text-slate-600"
        }`}
      >
        {typeof displayValue === "number" ? displayValue.toFixed(1) : displayValue}
        {hasValue && unit && (
          <span className="text-slate-500 ml-1 text-xs">{unit}</span>
        )}
      </span>
    </div>
  );
}
