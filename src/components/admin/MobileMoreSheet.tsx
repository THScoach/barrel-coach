import { TrendingUp, Calendar, Database, Dumbbell, MessageSquare } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface MobileMoreSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTab: (tab: string) => void;
  currentTab: string;
}

const moreOptions = [
  { value: "data", label: "Data Sessions", icon: Database, description: "HitTrax, Reboot & more" },
  { value: "transfer", label: "Transfer Mechanics", icon: TrendingUp, description: "Energy flow analysis" },
  { value: "schedule", label: "Schedule", icon: Calendar, description: "Upcoming sessions" },
  { value: "communication", label: "Communication", icon: MessageSquare, description: "Messages & notes" },
];

export function MobileMoreSheet({ 
  open, 
  onOpenChange, 
  onSelectTab,
  currentTab 
}: MobileMoreSheetProps) {
  const handleSelect = (value: string) => {
    onSelectTab(value);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom" 
        className="bg-slate-900 border-slate-800 rounded-t-3xl max-h-[60vh] pb-safe"
      >
        <SheetHeader className="pb-4">
          <SheetTitle className="text-white text-left">More Options</SheetTitle>
        </SheetHeader>
        
        <div className="space-y-2">
          {moreOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => handleSelect(option.value)}
              className={cn(
                "w-full flex items-center gap-4 p-4 rounded-xl transition-colors min-h-[56px]",
                currentTab === option.value
                  ? "bg-red-600/20 border border-red-600/40"
                  : "bg-slate-800/50 hover:bg-slate-800 border border-transparent"
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center",
                currentTab === option.value
                  ? "bg-gradient-to-br from-red-600 to-orange-500"
                  : "bg-slate-700"
              )}>
                <option.icon className="h-5 w-5 text-white" />
              </div>
              <div className="text-left">
                <div className={cn(
                  "font-medium",
                  currentTab === option.value ? "text-red-400" : "text-slate-200"
                )}>
                  {option.label}
                </div>
                <div className="text-sm text-slate-500">{option.description}</div>
              </div>
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
