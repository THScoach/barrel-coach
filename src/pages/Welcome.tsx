import { useSearchParams, Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";

const PLAN_NAMES: Record<string, string> = {
  starter: "Starter",
  academy: "The Academy",
  elite: "Elite",
};

export default function Welcome() {
  const [searchParams] = useSearchParams();
  const plan = searchParams.get("plan") || "";
  const planName = PLAN_NAMES[plan] || plan || "selected";

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-8">
        <Logo />

        <div className="space-y-3">
          <h1 className="text-3xl font-bold text-white">Welcome to Catching Barrels</h1>
          <p className="text-xl text-teal-400 font-semibold">
            You're now on the {planName} plan
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <Mail className="w-6 h-6 text-teal-400 flex-shrink-0" />
          <p className="text-slate-300 text-left">
            Check your email — we sent you a login link to get started.
          </p>
        </div>

        <Button asChild className="w-full bg-teal-500 hover:bg-teal-600 text-white font-bold py-6 text-lg">
          <Link to="/login">Go to Login</Link>
        </Button>
      </div>
    </div>
  );
}
