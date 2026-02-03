import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { Footer } from "@/components/Footer";
import { Sparkles, ArrowRight } from "lucide-react";
import betaProductCard from "@/assets/beta-product-card.png";

export default function Beta() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex items-center justify-between py-4">
          <Link to="/">
            <Logo />
          </Link>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-orange-500" />
            <span className="text-orange-500 font-semibold">Beta Program</span>
          </div>
        </div>
      </header>

      {/* Hero Section with Product Card Image */}
      <section className="py-16 lg:py-24 flex-1">
        <div className="container">
          <div className="max-w-4xl mx-auto space-y-10">
            {/* Product Card Image */}
            <div className="rounded-2xl overflow-hidden shadow-2xl shadow-orange-500/10 border border-slate-800">
              <img 
                src={betaProductCard} 
                alt="Catching Barrels Beta - $99/month founding member access" 
                className="w-full h-auto"
              />
            </div>

            {/* CTA Section */}
            <div className="text-center space-y-6">
              <Button
                asChild
                size="lg"
                className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold text-lg px-12 py-7 h-auto"
              >
                <a href="#paypal-link" target="_blank" rel="noopener noreferrer">
                  Join the Beta
                  <ArrowRight className="ml-2 h-5 w-5" />
                </a>
              </Button>
              
              <p className="text-sm text-slate-500">
                Cancel anytime. No contracts. No BS.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}
