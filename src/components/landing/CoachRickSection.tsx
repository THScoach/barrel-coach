import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import coachRickField from "@/assets/coach-rick-field.png";
import coachRickHands from "@/assets/coach-rick-hands.jpeg";

export function CoachRickSection() {
  return (
    <section className="py-14 sm:py-20 bg-slate-900/60">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-8 sm:gap-12 items-center">
          {/* Images */}
          <div className="relative">
            <div className="rounded-xl sm:rounded-2xl overflow-hidden border border-slate-700/50 shadow-2xl shadow-red-950/20">
              <img
                src={coachRickField}
                alt="Coach Rick on the field with professional players"
                className="w-full h-[280px] sm:h-[400px] object-cover object-top"
                loading="lazy"
              />
            </div>
            {/* Floating secondary image */}
            <div className="absolute -bottom-4 -right-2 sm:-bottom-6 sm:-right-4 w-28 h-28 sm:w-40 sm:h-40 rounded-xl overflow-hidden border-4 border-slate-950 shadow-xl hidden sm:block">
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
            <div className="inline-flex items-center gap-2 bg-red-600/10 border border-red-500/20 rounded-full px-3 sm:px-4 py-1.5 mb-4 sm:mb-6">
              <span className="text-[10px] sm:text-xs font-semibold text-red-400 tracking-wide uppercase">
                Your Coach
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black mb-3 sm:mb-4 leading-tight">
              Meet{" "}
              <span className="bg-gradient-to-r from-red-500 to-red-400 bg-clip-text text-transparent">
                Coach Rick
              </span>
            </h2>

            <p className="text-slate-300 text-base sm:text-lg mb-4 sm:mb-6 leading-relaxed">
              Active AAA Hitting Coach with 20+ years developing hitters at every level — 
              from first swings to the Major Leagues.
            </p>

            <ul className="space-y-2.5 sm:space-y-3 mb-6 sm:mb-8">
              {[
                "400+ college commits coached",
                "100+ professional players developed",
                "Transformed Cedric Mullins from .094 → All-Star",
                "Pioneer in biomechanics-driven hitting instruction",
                "Built the 4B System used by MLB organizations",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-slate-400 text-sm sm:text-base">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full mt-2 sm:mt-2.5 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <Button
              asChild
              size="lg"
              className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-6 text-base sm:text-lg shadow-lg shadow-red-600/20"
            >
              <Link to="/diagnostic" className="flex items-center justify-center gap-2">
                Get Coached by Rick <ArrowRight className="w-5 h-5" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
