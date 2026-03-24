import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import coachRickField from "@/assets/coach-rick-field.png";
import coachRickHands from "@/assets/coach-rick-hands.jpeg";

export function CoachRickSection() {
  return (
    <section className="py-20 bg-slate-900/60">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Images */}
          <div className="relative">
            <div className="rounded-2xl overflow-hidden border border-slate-700/50 shadow-2xl shadow-red-950/20">
              <img
                src={coachRickField}
                alt="Coach Rick on the field with professional players"
                className="w-full h-[400px] object-cover object-top"
                loading="lazy"
              />
            </div>
            {/* Floating secondary image */}
            <div className="absolute -bottom-6 -right-4 w-40 h-40 rounded-xl overflow-hidden border-4 border-slate-950 shadow-xl hidden sm:block">
              <img
                src={coachRickHands}
                alt="Coach Rick coaching a hitter's hand position"
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          </div>

          {/* Content */}
          <div>
            <div className="inline-flex items-center gap-2 bg-red-600/10 border border-red-500/20 rounded-full px-4 py-1.5 mb-6">
              <span className="text-xs font-semibold text-red-400 tracking-wide uppercase">
                Your Coach
              </span>
            </div>

            <h2 className="text-3xl md:text-4xl font-black mb-4 leading-tight">
              Meet{" "}
              <span className="bg-gradient-to-r from-red-500 to-red-400 bg-clip-text text-transparent">
                Coach Rick
              </span>
            </h2>

            <p className="text-slate-300 text-lg mb-6 leading-relaxed">
              Active AAA Hitting Coach with 20+ years developing hitters at every level — 
              from first swings to the Major Leagues.
            </p>

            <ul className="space-y-3 mb-8">
              {[
                "400+ college commits coached",
                "100+ professional players developed",
                "Transformed Cedric Mullins from .094 → All-Star",
                "Pioneer in biomechanics-driven hitting instruction",
                "Built the 4B System used by MLB organizations",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-slate-400">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full mt-2.5 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <Button
              asChild
              size="lg"
              className="bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-6 text-lg shadow-lg shadow-red-600/20"
            >
              <Link to="/diagnostic" className="flex items-center gap-2">
                Get Coached by Rick <ArrowRight className="w-5 h-5" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
