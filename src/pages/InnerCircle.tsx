import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import {
  Check,
  X,
  MessageCircle,
  Video,
  Users,
  ChartBar,
  Calendar,
  Percent,
  Shield,
  Loader2,
  Star,
  Zap,
  Crown,
  ArrowRight,
  ChevronDown,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

// MASTER PROMPT v1.0 — Guided Coaching Features
const features = [
  {
    icon: TrendingUp,
    title: "Ongoing Data Uploads",
    description: "Submit your swing videos and data anytime. Track your progress across the 4B System.",
    gradient: "from-blue-500 to-cyan-600",
    glow: "shadow-blue-500/25",
    iconBg: "bg-blue-500/20",
    iconColor: "text-blue-400",
  },
  {
    icon: Calendar,
    title: "Weekly AI Check-Ins",
    description: "Every week, Rick's system reviews your progress, identifies trends, and keeps you on track.",
    gradient: "from-purple-500 to-violet-600",
    glow: "shadow-purple-500/25",
    iconBg: "bg-purple-500/20",
    iconColor: "text-purple-400",
  },
  {
    icon: ChartBar,
    title: "Trend Tracking",
    description: "See your 4B scores over time. Know if you're improving or sliding backward.",
    gradient: "from-emerald-500 to-green-600",
    glow: "shadow-emerald-500/25",
    iconBg: "bg-emerald-500/20",
    iconColor: "text-emerald-400",
  },
  {
    icon: Shield,
    title: "Clear Benchmarks",
    description: "Understand where you stand. Age-appropriate targets that matter.",
    gradient: "from-orange-500 to-amber-600",
    glow: "shadow-orange-500/25",
    iconBg: "bg-orange-500/20",
    iconColor: "text-orange-400",
  },
  {
    icon: Users,
    title: "Accountability",
    description: "No more guessing. The system keeps you honest about your work.",
    gradient: "from-pink-500 to-rose-600",
    glow: "shadow-pink-500/25",
    iconBg: "bg-pink-500/20",
    iconColor: "text-pink-400",
  },
  {
    icon: Zap,
    title: "Direction When Stuck",
    description: "When you hit a wall, Rick's system tells you what to focus on next.",
    gradient: "from-yellow-500 to-orange-600",
    glow: "shadow-yellow-500/25",
    iconBg: "bg-yellow-500/20",
    iconColor: "text-yellow-400",
  },
];

// MASTER PROMPT v1.0 — Guided Coaching is for...
const whoIsThisFor = [
  "You want ongoing structure, not just a one-time analysis",
  "You're serious about consistency and accountability",
  "You want to track your progress over time",
  "You need clear benchmarks to measure against",
  "You're willing to put in the work between sessions",
];

const testimonials = [
  {
    quote: "The monthly calls alone are worth it. Getting real-time feedback on my son's swing has been a game-changer.",
    name: "Mike D.",
    role: "Baseball Dad, Texas",
    rating: 5,
  },
  {
    quote: "I've learned more in 3 months than 5 years of lessons. The 4B System finally made it click.",
    name: "Jason T.",
    role: "High School Coach",
    rating: 5,
  },
  {
    quote: "Direct text access to Coach Rick? That's insane value. I use it every week.",
    name: "Marcus W.",
    role: "College Commit",
    rating: 5,
  },
];

const faqs = [
  {
    question: "Can I cancel anytime?",
    answer: "Yes. No contracts, no commitments. Cancel with one click anytime from your account settings. You'll keep access until the end of your billing period.",
  },
  {
    question: "How do the live calls work?",
    answer: "We do group Zoom calls every Monday at 7pm CST. You can submit swings beforehand or ask questions live. Calls are recorded if you can't make it.",
  },
  {
    question: "How quickly will Coach Rick respond?",
    answer: "Priority members get responses within 24 hours, usually much faster. For urgent game-day questions, same-day responses are common.",
  },
  {
    question: "Is this for kids or adults?",
    answer: "Both. The 4B System works for any age. We have members from 10-year-olds to adult rec league players to coaches in their 60s.",
  },
  {
    question: "What if I'm already a customer?",
    answer: "Any previous purchases ($37 or $97) count toward your first month. Just email us after joining for a credit.",
  },
];

// MASTER PROMPT v1.0 — Product comparison (Guided Coaching at $99/mo)
const comparisonData = [
  { feature: "Free Diagnostic Snapshot", single: true, complete: true, inner: true },
  { feature: "Weekly AI-Guided Check-Ins", single: false, complete: false, inner: true },
  { feature: "Ongoing Data Uploads", single: false, complete: false, inner: true },
  { feature: "Trend Tracking & Benchmarks", single: false, complete: false, inner: true },
  { feature: "In-Person Assessment", single: false, complete: true, inner: "20% off" },
  { feature: "90-Day Transformation", single: "Apply", complete: "Apply", inner: "Priority" },
];

export default function InnerCircle() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleCheckout = async () => {
    if (!email || !email.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-inner-circle-checkout", {
        body: { email },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (error) {
      console.error("Checkout failed:", error);
      toast.error("Failed to start checkout. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <Header />

      {/* ===== HERO SECTION ===== */}
      <section className="relative pt-28 pb-24 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-yellow-900/30 via-transparent to-transparent" />
        
        {/* Animated glow orbs */}
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-yellow-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-40 right-1/4 w-72 h-72 bg-orange-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />

        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto animate-fade-in">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/30 mb-8 backdrop-blur-sm">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              <span className="text-sm font-bold text-blue-400 uppercase tracking-wider">Ongoing Structure</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-black text-white mb-6 tracking-tight leading-tight">
              GUIDED{" "}
              <span className="relative">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400">
                  COACHING
                </span>
                <span className="absolute -inset-1 bg-gradient-to-r from-blue-400/20 to-cyan-400/20 blur-xl -z-10" />
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-slate-300 mb-10 max-w-2xl mx-auto leading-relaxed">
              This is where clarity becomes consistency. Weekly check-ins, trend tracking, and accountability — all in Rick's voice.
            </p>

            {/* Price Card */}
            <div className="relative inline-block">
              {/* Outer glow */}
              <div className="absolute -inset-2 bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-500 rounded-3xl blur-lg opacity-40 animate-pulse" />
              
              {/* Card */}
              <div className="relative bg-gradient-to-b from-slate-900 to-slate-900/95 border-2 border-blue-500/40 rounded-3xl p-10 backdrop-blur-xl shadow-2xl shadow-blue-500/20">
                {/* Badge */}
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Ongoing Structure</span>
                </div>

                <div className="flex items-baseline justify-center gap-2 mb-3 mt-2">
                  <span className="text-6xl md:text-7xl font-black text-white">$99</span>
                  <span className="text-2xl text-slate-400 font-medium">/month</span>
                </div>
                <p className="text-slate-400 mb-8 text-lg">Cancel anytime. No contracts.</p>

                {/* Email + CTA */}
                <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-slate-800/80 border-slate-600 text-white placeholder:text-slate-500 h-14 text-lg rounded-xl focus:border-yellow-500 focus:ring-yellow-500/20"
                  />
                  <Button
                    onClick={handleCheckout}
                    disabled={isLoading}
                    className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-bold h-14 px-10 text-lg rounded-xl whitespace-nowrap shadow-lg shadow-yellow-500/30 hover:shadow-yellow-500/50 transition-all duration-300 hover:scale-105"
                  >
                    {isLoading ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <>
                        Join Now
                        <ArrowRight className="w-5 h-5 ml-2" />
                      </>
                    )}
                  </Button>
                </div>

                {/* Trust badges */}
                <div className="flex items-center justify-center gap-8 mt-8 text-sm">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Shield className="w-5 h-5 text-green-400" />
                    <span>30-Day Guarantee</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <Check className="w-5 h-5 text-green-400" />
                    <span>Cancel Anytime</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Scroll indicator */}
            <div className="mt-16 animate-bounce">
              <ChevronDown className="w-8 h-8 text-slate-500 mx-auto" />
            </div>
          </div>
        </div>
      </section>

      {/* ===== FEATURES SECTION ===== */}
      <section className="py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900/50 to-slate-950" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
              EVERYTHING YOU{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400">GET</span>
            </h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              Six powerful tools to accelerate your hitting development
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <div
                key={i}
                className={`group relative p-8 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all duration-500 hover:shadow-2xl ${feature.glow} hover:-translate-y-1`}
              >
                {/* Gradient line at top */}
                <div className={`absolute top-0 left-8 right-8 h-1 bg-gradient-to-r ${feature.gradient} rounded-full opacity-60 group-hover:opacity-100 transition-opacity`} />
                
                <div className={`inline-flex p-4 rounded-2xl ${feature.iconBg} border border-white/5 mb-5`}>
                  <feature.icon className={`w-7 h-7 ${feature.iconColor}`} />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                <p className="text-slate-400 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== COMPARISON TABLE ===== */}
      <section className="py-24 bg-slate-900/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
              COMPARE{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400">OPTIONS</span>
            </h2>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-6 px-6 text-slate-400 font-semibold text-lg">Feature</th>
                  <th className="text-center py-6 px-6">
                    <div className="text-slate-400 font-medium text-sm uppercase tracking-wider">Single Swing</div>
                    <div className="text-white font-bold text-xl mt-1">$37</div>
                  </th>
                  <th className="text-center py-6 px-6">
                    <div className="text-slate-400 font-medium text-sm uppercase tracking-wider">Complete Review</div>
                    <div className="text-white font-bold text-xl mt-1">$97</div>
                  </th>
                  <th className="text-center py-6 px-6 relative">
                    {/* Highlighted column header */}
                    <div className="absolute inset-0 bg-gradient-to-b from-yellow-500/20 to-transparent rounded-t-xl" />
                    <div className="relative">
                      <div className="inline-flex items-center gap-1 text-yellow-400 font-medium text-sm uppercase tracking-wider">
                        <Crown className="w-4 h-4" />
                        Inner Circle
                      </div>
                      <div className="text-white font-bold text-xl mt-1">$297/mo</div>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisonData.map((row, i) => (
                  <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    <td className="py-5 px-6 text-slate-300 font-medium">{row.feature}</td>
                    <td className="text-center py-5 px-6">
                      {typeof row.single === "boolean" ? (
                        row.single ? (
                          <Check className="w-6 h-6 text-green-400 mx-auto" />
                        ) : (
                          <X className="w-6 h-6 text-slate-600 mx-auto" />
                        )
                      ) : (
                        <span className="text-slate-400">{row.single}</span>
                      )}
                    </td>
                    <td className="text-center py-5 px-6">
                      {typeof row.complete === "boolean" ? (
                        row.complete ? (
                          <Check className="w-6 h-6 text-green-400 mx-auto" />
                        ) : (
                          <X className="w-6 h-6 text-slate-600 mx-auto" />
                        )
                      ) : (
                        <span className="text-slate-400">{row.complete}</span>
                      )}
                    </td>
                    <td className="text-center py-5 px-6 relative">
                      {/* Highlighted column */}
                      <div className="absolute inset-0 bg-yellow-500/5" />
                      <div className="relative">
                        {typeof row.inner === "boolean" ? (
                          row.inner ? (
                            <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-yellow-500/20">
                              <Check className="w-5 h-5 text-yellow-400" />
                            </div>
                          ) : (
                            <X className="w-6 h-6 text-slate-600 mx-auto" />
                          )
                        ) : (
                          <span className="text-yellow-400 font-bold">{row.inner}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ===== WHO IS THIS FOR ===== */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
              IS THIS{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400">FOR YOU?</span>
            </h2>
            <p className="text-xl text-slate-400">The Inner Circle is perfect if...</p>
          </div>

          <div className="space-y-4">
            {whoIsThisFor.map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-5 p-5 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-yellow-500/30 transition-all duration-300 group"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-yellow-500/30 to-orange-500/30 flex items-center justify-center group-hover:from-yellow-500/50 group-hover:to-orange-500/50 transition-all">
                  <Check className="w-5 h-5 text-yellow-400" />
                </div>
                <span className="text-white text-lg font-medium">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== TESTIMONIALS ===== */}
      <section className="py-24 bg-slate-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
              MEMBER{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400">REVIEWS</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, i) => (
              <div
                key={i}
                className="relative p-8 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-yellow-500/30 transition-all duration-300 group"
              >
                {/* Quote mark */}
                <div className="absolute top-6 right-6 text-6xl font-serif text-yellow-500/10 group-hover:text-yellow-500/20 transition-colors">
                  "
                </div>

                {/* Stars */}
                <div className="flex gap-1 mb-5">
                  {[...Array(testimonial.rating)].map((_, j) => (
                    <Star key={j} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>

                <p className="text-slate-300 mb-8 text-lg leading-relaxed">"{testimonial.quote}"</p>

                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-500/30 to-orange-500/30 flex items-center justify-center text-white font-bold text-lg">
                    {testimonial.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-white font-semibold">{testimonial.name}</div>
                    <div className="text-sm text-slate-500">{testimonial.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FAQ SECTION ===== */}
      <section className="py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
              COMMON{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400">QUESTIONS</span>
            </h2>
          </div>

          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="bg-slate-900/50 border border-slate-800 rounded-2xl px-6 data-[state=open]:border-yellow-500/30 data-[state=open]:bg-slate-900/80 transition-all"
              >
                <AccordionTrigger className="text-white text-left font-semibold text-lg hover:no-underline py-5 hover:text-yellow-400 transition-colors">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-slate-400 pb-5 text-base leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ===== FINAL CTA ===== */}
      <section className="py-24 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-yellow-950/10 to-slate-950" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-yellow-500/10 rounded-full blur-3xl" />

        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-6xl font-black text-white mb-6">
            READY TO{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400">LEVEL UP?</span>
          </h2>
          <p className="text-xl text-slate-400 mb-12 max-w-2xl mx-auto">
            Join hundreds of players and coaches who are transforming their swings with the Inner Circle.
          </p>

          {/* Final Price Card */}
          <div className="relative inline-block">
            <div className="absolute -inset-2 bg-gradient-to-r from-yellow-500 via-orange-500 to-yellow-500 rounded-3xl blur-lg opacity-40" />
            
            <div className="relative bg-slate-900 border-2 border-yellow-500/40 rounded-3xl p-10 backdrop-blur-xl">
              <div className="flex items-baseline justify-center gap-2 mb-6">
                <span className="text-5xl font-black text-white">$297</span>
                <span className="text-xl text-slate-400">/month</span>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto mb-6">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-slate-800/80 border-slate-600 text-white placeholder:text-slate-500 h-14 text-lg rounded-xl focus:border-yellow-500"
                />
                <Button
                  onClick={handleCheckout}
                  disabled={isLoading}
                  className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-bold h-14 px-10 text-lg rounded-xl whitespace-nowrap shadow-lg shadow-yellow-500/30 hover:shadow-yellow-500/50 transition-all duration-300 hover:scale-105"
                >
                  {isLoading ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      Join Inner Circle
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>
              </div>

              <div className="flex items-center justify-center gap-2 text-slate-400">
                <Shield className="w-5 h-5 text-green-400" />
                <span>30-Day Money-Back Guarantee</span>
              </div>
            </div>
          </div>

          <p className="text-slate-500 text-sm mt-10">
            Questions? Email{" "}
            <a href="mailto:support@catchingbarrels.com" className="text-yellow-400 hover:underline">
              support@catchingbarrels.com
            </a>
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
