/**
 * Quick Actions Row - Stack-style horizontal scrolling action buttons
 * Icons with labels for common player actions
 */
import { Share2, Zap, BarChart3, RefreshCw, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickAction {
  id: string;
  icon: typeof Share2;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}

interface QuickActionsRowProps {
  onShareProgress?: () => void;
  onSpecialSession?: () => void;
  onViewHistory?: () => void;
  onChangeProgram?: () => void;
  onCompletedPrograms?: () => void;
}

export function QuickActionsRow({
  onShareProgress,
  onSpecialSession,
  onViewHistory,
  onChangeProgram,
  onCompletedPrograms,
}: QuickActionsRowProps) {
  const actions: QuickAction[] = [
    { id: 'share', icon: Share2, label: 'Share Progress', onClick: onShareProgress },
    { id: 'special', icon: Zap, label: 'Special Session', onClick: onSpecialSession },
    { id: 'history', icon: BarChart3, label: 'Session History', onClick: onViewHistory },
    { id: 'change', icon: RefreshCw, label: 'Change Focus', onClick: onChangeProgram },
    { id: 'completed', icon: ListChecks, label: 'Completed', onClick: onCompletedPrograms },
  ];

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
      {actions.map(({ id, icon: Icon, label, onClick, disabled }) => (
        <button
          key={id}
          onClick={onClick}
          disabled={disabled}
          className={cn(
            "flex-shrink-0 flex flex-col items-center gap-1.5 p-3 min-w-[72px]",
            "bg-slate-800/50 border border-slate-700 rounded-lg",
            "hover:bg-slate-700/50 hover:border-slate-600 transition-all",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          <Icon className="h-5 w-5 text-slate-300" />
          <span className="text-[10px] text-slate-400 font-medium text-center leading-tight whitespace-nowrap">
            {label}
          </span>
        </button>
      ))}
    </div>
  );
}
