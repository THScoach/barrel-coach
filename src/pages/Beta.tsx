import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Logo } from "@/components/Logo";
import { Footer } from "@/components/Footer";
import { Radio, Calendar, MapPin, Sparkles, ArrowRight, CheckCircle } from "lucide-react";

export default function Beta() {
  const features = [
    {
      icon: Radio,
      title: "Swing Sensor",
      description: "Dynamic & magnetic sensors shipped directly to you. Track every swing with pro-level data.",
    },
    {
      icon: Calendar,
      title: "Monday Night Calls",
      description: "Weekly group sessions breaking down your data live with Coach Rick.",
    },
    {
      icon: MapPin,
      title: "Offseason Training",
      description: "Unlimited in-person sessions with Coach Rick during the offseason.",
    },
  ];

  const benefits = [
    "Kinetic DNA analysis for every swing",
    "Personalized drill prescriptions",
    "Direct access to Coach Rick",
    "Priority video analysis",
    "Founding member pricing locked for life",
  ];

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

      {/* Hero Section */}
      <section className="py-20 lg:py-28">
        <div className="container">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            {/* Beta Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/10 border border-orange-500/30">
              <Sparkles className="h-4 w-4 text-orange-500" />
              <span className="text-sm text-orange-500 font-semibold uppercase tracking-wide">Founding Member Access</span>
            </div>

            {/* Headline */}
            <h1 className="text-5xl lg:text-7xl font-bold text-white leading-tight">
              Catching Barrels{" "}
              <span className="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
                Beta
              </span>
            </h1>

            {/* Subhead */}
            <p className="text-xl lg:text-2xl text-slate-400 max-w-2xl mx-auto">
              Founding member access to elite swing training
            </p>

            {/* Price Badge */}
            <div className="inline-flex items-baseline gap-1 px-6 py-3 rounded-2xl bg-slate-900 border border-slate-700">
              <span className="text-4xl lg:text-5xl font-bold text-white">$99</span>
              <span className="text-xl text-slate-400">/month</span>
            </div>

            {/* CTA Button */}
            <div className="pt-4">
              <Button
                asChild
                size="lg"
                className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold text-lg px-10 py-6 h-auto"
              >
                <a href="#paypal-link" target="_blank" rel="noopener noreferrer">
                  Join the Beta
                  <ArrowRight className="ml-2 h-5 w-5" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* What's Included */}
      <section className="py-16 bg-slate-900/50">
        <div className="container">
          <h2 className="text-3xl font-bold text-white text-center mb-12">What's Included</h2>
          
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {features.map((feature, i) => (
              <Card key={i} className="bg-slate-900 border-slate-800 hover:border-orange-500/50 transition-colors">
                <CardContent className="p-6 text-center space-y-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center mx-auto">
                    <feature.icon className="h-7 w-7 text-orange-500" />
                  </div>
                  <h3 className="text-xl font-bold text-white">{feature.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits List */}
      <section className="py-16">
        <div className="container">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-white text-center mb-8">Everything You Get</h2>
            <div className="space-y-4">
              {benefits.map((benefit, i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                  <span className="text-slate-300">{benefit}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Limited Spots CTA */}
      <section className="py-16 bg-gradient-to-r from-orange-500/10 via-red-500/10 to-orange-500/10 border-y border-orange-500/20">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/20 border border-orange-500/30">
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
              <span className="text-sm text-orange-400 font-medium">Limited Availability</span>
            </div>
            
            <h2 className="text-3xl lg:text-4xl font-bold text-white">
              Limited founding member spots.
            </h2>
            <p className="text-xl text-slate-300">
              Lock in <span className="text-orange-500 font-bold">$99/month for life</span>.
            </p>
            
            <Button
              asChild
              size="lg"
              className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold text-lg px-10 py-6 h-auto"
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
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}
