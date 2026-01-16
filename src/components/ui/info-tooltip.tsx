import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface InfoTooltipProps {
  content: string;
  className?: string;
  iconClassName?: string;
}

export function InfoTooltip({ content, className, iconClassName }: InfoTooltipProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button 
          type="button"
          className={cn(
            "inline-flex items-center justify-center rounded-full p-0.5 hover:bg-slate-700/50 transition-colors",
            className
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <Info className={cn("h-3.5 w-3.5 text-slate-500 hover:text-slate-400", iconClassName)} />
        </button>
      </PopoverTrigger>
      <PopoverContent 
        side="top" 
        align="center"
        className="max-w-xs bg-slate-800 border-slate-700 text-white text-xs p-3 shadow-xl z-50"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="leading-relaxed">{content}</p>
      </PopoverContent>
    </Popover>
  );
}

export default InfoTooltip;
