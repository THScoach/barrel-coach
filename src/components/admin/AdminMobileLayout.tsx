import { ReactNode } from "react";
import { AdminHeader } from "@/components/AdminHeader";
import { MobileBottomNav } from "./MobileBottomNav";
import { useIsMobile } from "@/hooks/use-mobile";

interface AdminMobileLayoutProps {
  children: ReactNode;
  showHeader?: boolean;
  className?: string;
}

export function AdminMobileLayout({ 
  children, 
  showHeader = true,
  className = "" 
}: AdminMobileLayoutProps) {
  const isMobile = useIsMobile();

  return (
    <div className={`min-h-screen bg-slate-950 ${className}`}>
      {showHeader && <AdminHeader />}
      
      {/* Main content with bottom padding on mobile for nav bar */}
      <div className={isMobile ? "pb-20" : ""}>
        {children}
      </div>

      {/* Mobile bottom navigation */}
      {isMobile && <MobileBottomNav />}
    </div>
  );
}
