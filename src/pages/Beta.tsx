import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Sparkles, Zap, Target, TrendingUp, CheckCircle } from "lucide-react";
import { Logo } from "@/components/Logo";

export default function Beta() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast.success("Account created! Check your email to confirm.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success("Welcome to the beta! 🔥");
        navigate("/player");
      }
    } catch (error: any) {
      toast.error(error.message || "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const features = [
    { icon: Zap, label: "4B System Analysis", desc: "Brain, Body, Bat, Ball scoring" },
    { icon: Target, label: "AI Video Analysis", desc: "Upload swings for instant feedback" },
    { icon: TrendingUp, label: "Progress Tracking", desc: "Track your development over time" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm">
        <div className="container flex items-center justify-between py-4">
          <Link to="/">
            <Logo />
          </Link>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            <span className="text-yellow-500 font-semibold">Beta Access</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Welcome Message */}
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/30">
                <Sparkles className="h-4 w-4 text-yellow-500" />
                <span className="text-sm text-yellow-500 font-medium">Exclusive Beta Access</span>
              </div>
              <h1 className="text-4xl lg:text-5xl font-bold text-white leading-tight">
                You're Invited to the{" "}
                <span className="bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
                  4B System
                </span>
              </h1>
              <p className="text-lg text-slate-400">
                Coach Rick personally invited you to test the most advanced swing analysis 
                technology available. Get early access to features before anyone else.
              </p>
            </div>

            {/* Features */}
            <div className="space-y-4">
              {features.map((feature, i) => (
                <div key={i} className="flex items-start gap-4 p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-red-600/20 to-orange-500/20">
                    <feature.icon className="h-5 w-5 text-orange-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">{feature.label}</p>
                    <p className="text-sm text-slate-400">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Beta Perks */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="h-5 w-5 text-yellow-500" />
                <span className="font-semibold text-white">Beta Tester Perks</span>
              </div>
              <ul className="space-y-2 text-sm text-slate-300">
                <li>• 60 days of full access to all features</li>
                <li>• Direct line to Coach Rick for feedback</li>
                <li>• Special pricing when we launch</li>
                <li>• Shape the future of the product</li>
              </ul>
            </div>
          </div>

          {/* Right: Auth Form */}
          <Card className="bg-slate-900/80 border-slate-800">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-2xl text-white">
                {mode === "login" ? "Welcome Back" : "Create Your Account"}
              </CardTitle>
              <CardDescription className="text-slate-400">
                {mode === "login" 
                  ? "Sign in to access your beta account" 
                  : "Get started with your 60-day beta access"
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-300">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-300">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 text-white font-semibold"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {mode === "login" ? "Signing In..." : "Creating Account..."}
                    </>
                  ) : (
                    mode === "login" ? "Sign In" : "Create Account"
                  )}
                </Button>
              </form>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setMode(mode === "login" ? "signup" : "login")}
                  className="text-sm text-slate-400 hover:text-white transition-colors"
                >
                  {mode === "login" 
                    ? "New here? Create an account" 
                    : "Already have an account? Sign in"
                  }
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-6">
        <div className="container text-center text-sm text-slate-500">
          <p>Questions? Text Coach Rick directly or reply to your invite SMS.</p>
        </div>
      </footer>
    </div>
  );
}
