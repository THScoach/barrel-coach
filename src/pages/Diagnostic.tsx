import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { ArrowRight, Upload, Target, Eye, Zap } from "lucide-react";
import { Link } from "react-router-dom";

export default function Diagnostic() {
  return (
    <div className="min-h-screen bg-slate-950">
      <Header />

      <section className="pt-32 pb-20">
        <div className="max-w-4xl mx-auto px-4">
          {/* Hero */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20 mb-6">
              <Target className="w-4 h-4 text-red-400" />
              <span className="text-sm font-bold text-red-400 uppercase tracking-wider">
                Free Swing Diagnostic
              </span>
            </div>

            <h1 className="text-4xl md:text-6xl font-black text-white mb-6">
              GET YOUR <span className="text-red-500">SNAPSHOT</span>
            </h1>

            <p className="text-xl text-slate-300 max-w-2xl mx-auto mb-4">
              Upload your swing. I'll look at it and tell you what's happening — not what you want to hear.
            </p>
            <p className="text-lg text-slate-500 max-w-xl mx-auto">
              This is a one-time diagnostic. One response. Clarity, not coaching.
            </p>
          </div>

          {/* What You Get */}
          <div className="grid md:grid-cols-3 gap-6 mb-16">
            <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <Eye className="w-6 h-6 text-red-400" />
              </div>
              <h3 className="font-bold text-white mb-2">Priority Identified</h3>
              <p className="text-sm text-slate-400">
                What's actually limiting your swing — not guesses.
              </p>
            </div>

            <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
                <Target className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="font-bold text-white mb-2">Direction Given</h3>
              <p className="text-sm text-slate-400">
                One clear next step. No noise.
              </p>
            </div>

            <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                <Zap className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="font-bold text-white mb-2">Delivered via SMS</h3>
              <p className="text-sm text-slate-400">
                Short analysis from Rick. Straight to your phone.
              </p>
            </div>
          </div>

          {/* What This Is NOT */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 mb-16">
            <h2 className="text-xl font-bold text-white mb-4">
              What This Is NOT:
            </h2>
            <ul className="space-y-3 text-slate-400">
              <li className="flex items-start gap-3">
                <span className="text-red-400 font-bold">✕</span>
                A back-and-forth conversation. One response, that's it.
              </li>
              <li className="flex items-start gap-3">
                <span className="text-red-400 font-bold">✕</span>
                A full training plan. That's what the $99/month coaching is for.
              </li>
              <li className="flex items-start gap-3">
                <span className="text-red-400 font-bold">✕</span>
                Validation. If you want someone to tell you you're great, look elsewhere.
              </li>
            </ul>
          </div>

          {/* CTA */}
          <div className="text-center">
            <Button
              asChild
              size="lg"
              className="bg-red-600 hover:bg-red-700 text-white font-bold h-16 px-12 text-lg"
            >
              <Link to="/analyze">
                <Upload className="w-5 h-5 mr-3" />
                Upload Your Swing
                <ArrowRight className="w-5 h-5 ml-3" />
              </Link>
            </Button>
            <p className="text-sm text-slate-500 mt-4">
              No credit card. No commitment. Just truth.
            </p>
          </div>
        </div>
      </section>

      {/* Next Steps Preview */}
      <section className="py-16 bg-slate-900/50 border-t border-slate-800">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">
            Ready to Go Deeper?
          </h2>
          <p className="text-slate-400 mb-8">
            After your diagnostic, here's where you can go next.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-red-500/50 text-red-400 hover:bg-red-500/10"
            >
              <Link to="/coaching">
                Online Coaching — $99/mo
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
            >
              <Link to="/assessment">
                In-Person Assessment — $299
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
