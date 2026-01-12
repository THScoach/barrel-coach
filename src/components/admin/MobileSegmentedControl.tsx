import { cn } from "@/lib/utils";

interface SegmentOption {
  value: string;
  label: string;
}

interface MobileSegmentedControlProps {
  options: SegmentOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function MobileSegmentedControl({
  options,
  value,
  onChange,
  className,
}: MobileSegmentedControlProps) {
  return (
    <div 
      className={cn(
        "inline-flex p-1 rounded-xl bg-slate-800/80 border border-slate-700/50",
        className
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "px-4 py-2.5 text-sm font-medium rounded-lg transition-all min-h-[44px]",
            value === option.value
              ? "bg-gradient-to-br from-red-600 to-orange-500 text-white shadow-lg"
              : "text-slate-400 hover:text-slate-200"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
