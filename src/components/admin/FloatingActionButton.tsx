import { Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface FloatingActionButtonProps {
  to: string;
  label?: string;
  className?: string;
}

export function FloatingActionButton({ 
  to, 
  label = "New Session",
  className 
}: FloatingActionButtonProps) {
  return (
    <Link
      to={to}
      className={cn(
        "fixed bottom-24 right-4 z-40 md:hidden",
        "flex items-center gap-2 px-5 py-3.5 min-h-[48px]",
        "bg-gradient-to-r from-red-600 to-orange-500",
        "text-white font-semibold text-sm",
        "rounded-full shadow-xl shadow-red-900/40",
        "active:scale-95 transition-transform",
        className
      )}
    >
      <Plus className="h-5 w-5" />
      <span>{label}</span>
    </Link>
  );
}
