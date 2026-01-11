import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { HeroScoreCard } from "@/components/landing/HeroScoreCard";
import { SocialProofSection } from "@/components/landing/SocialProofSection";
import { FourBSystemSection } from "@/components/landing/FourBSystemSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { MLBTechnologySection } from "@/components/landing/MLBTechnologySection";
import { ProductComparisonSection } from "@/components/landing/ProductComparisonSection";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play, Target, Zap, Award, Users } from "lucide-react";
import { Link } from "react-router-dom";

export default function Index() {
  return (
    <div className="min-h-screen bg-slate-950">
      <Header />

      {/* ===== HERO SECTION ===== */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
        {/* Video Background */}
        <div className="absolute inset-0">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
          >
            <source src="/videos/hero-swing.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/90 to-slate-950/70" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Copy */}
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20 mb-6">
                <Target className="w-4 h-4 text-red-400" />
                <span className="text-sm font-semibold text-red-400 uppercase tracking-wider">
                  MLB-Grade Analysis
                </span>
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white mb-6 tracking-tight leading-tight">
                HIT HARDER.{" "}
                <span className="text-red-500">MAKE CONTACT</span>{" "}
                MORE OFTEN.{" "}
                <span className="text-red-500">GET RECRUITED.</span>
              </h1>

              <p className="text-xl text-slate-300 mb-8 max-w-xl mx-auto lg:mx-0">
                Video analysis + drill plan delivered in under 48 hours. Powered by the same 4B System™ used by 78+ pro players.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Button
                  asChild
                  size="lg"
                  className="bg-red-600 hover:bg-red-700 text-white font-bold h-14 px-8 text-lg"
                >
                  <Link to="/analyze">
                    GET MY SWING SCORE
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-slate-600 text-white hover:bg-slate-800 h-14 px-8 text-lg"
                >
                  <a href="#how-it-works">
                    <Play className="w-5 h-5 mr-2" />
                    See How It Works
                  </a>
                </Button>
              </div>

              {/* Trust Stats */}
              <div className="flex items-center gap-8 mt-10 justify-center lg:justify-start">
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">1,000+</div>
                  <div className="text-sm text-slate-400">Swings Analyzed</div>
                </div>
                <div className="w-px h-10 bg-slate-700" />
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">400+</div>
                  <div className="text-sm text-slate-400">College Commits</div>
                </div>
                <div className="w-px h-10 bg-slate-700" />
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">78+</div>
                  <div className="text-sm text-slate-400">Pro Players</div>
                </div>
              </div>
            </div>

            {/* Right: Score Card */}
            <div className="flex justify-center lg:justify-end">
              <HeroScoreCard />
            </div>
          </div>
        </div>
      </section>

      {/* ===== SOCIAL PROOF ===== */}
      <SocialProofSection />

      {/* ===== HOW IT WORKS ===== */}
      <div id="how-it-works">
        <HowItWorksSection />
      </div>

      {/* ===== 4B SYSTEM ===== */}
      <FourBSystemSection />

      {/* ===== MLB TECHNOLOGY ===== */}
      <MLBTechnologySection />

      {/* ===== PRODUCT COMPARISON / PRICING ===== */}
      <div id="pricing">
        <ProductComparisonSection />
      </div>

      {/* ===== INNER CIRCLE CTA ===== */}
      <section className="py-20 bg-gradient-to-b from-slate-900 to-slate-950">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/10 border border-yellow-500/20 mb-6">
            <Award className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-semibold text-yellow-400 uppercase tracking-wider">
              Premium Membership
            </span>
          </div>

          <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
            WANT <span className="text-yellow-400">UNLIMITED</span> ACCESS?
          </h2>

          <p className="text-lg text-slate-400 mb-8 max-w-2xl mx-auto">
            Join the Inner Circle for weekly live calls with Coach Rick, 200+ drill videos, direct text access, and unlimited swing reviews.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              asChild
              size="lg"
              className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold h-14 px-8 text-lg"
            >
              <Link to="/inner-circle">
                <Users className="w-5 h-5 mr-2" />
                Learn About Inner Circle
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </Button>
          </div>

          <p className="text-sm text-slate-500 mt-6">
            $297/month • Cancel anytime • 30-day guarantee
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
