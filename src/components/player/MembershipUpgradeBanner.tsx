import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Clock, Crown, Zap } from "lucide-react";

interface MembershipUpgradeBannerProps {
  currentPlan: "assessment" | "monthly" | "annual" | "none";
  isFoundingMember?: boolean;
}

export function MembershipUpgradeBanner({ 
  currentPlan, 
  isFoundingMember = false 
}: MembershipUpgradeBannerProps) {
  // If they're on annual or monthly membership, show their current plan badge
  if (currentPlan === "annual" || currentPlan === "monthly") {
    return (
      <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Crown className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">Catching Barrels Member</h3>
                  {isFoundingMember && (
                    <span className="text-xs font-bold bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">
                      Founding Member
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {currentPlan === "annual" 
                    ? "Annual plan active" 
                    : "$99/mo plan active"
                  }
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // If they only have the $37 assessment, show upgrade banner
  if (currentPlan === "assessment") {
    return (
      <Card className="border-yellow-500/30 bg-gradient-to-r from-yellow-500/5 to-red-500/5">
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
                <Zap className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <h3 className="font-semibold">Upgrade to Full Membership</h3>
                <p className="text-sm text-muted-foreground">
                  Get weekly calls, unlimited uploads, Rick AI, and monthly retests.
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm font-bold text-white">$99/mo</span>
                  <span className="text-sm text-muted-foreground">or</span>
                  <span className="text-sm font-bold text-yellow-400">$899/year</span>
                  <div className="flex items-center gap-1 text-xs text-yellow-400">
                    <Clock className="w-3 h-3" />
                    until March 1
                  </div>
                </div>
              </div>
            </div>
            <Button asChild className="bg-red-600 hover:bg-red-700 whitespace-nowrap">
              <Link to="/coaching">
                Upgrade Now
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Default: no plan, encourage to get assessed or join
  return (
    <Card className="border-blue-500/30 bg-gradient-to-r from-blue-500/5 to-red-500/5">
      <CardContent className="pt-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold">Get Your Full KRS Report</h3>
              <p className="text-sm text-muted-foreground">
                Start with a $37 assessment or go straight to membership.
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm font-bold text-blue-400">$37 one-time</span>
                <span className="text-sm text-muted-foreground">or</span>
                <span className="text-sm font-bold text-red-400">$99/mo membership</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/diagnostic">$37 Assessment</Link>
            </Button>
            <Button asChild size="sm" className="bg-red-600 hover:bg-red-700">
              <Link to="/coaching">Join Membership</Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
