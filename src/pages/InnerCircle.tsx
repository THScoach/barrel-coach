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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import fourBSystemGraphic from "@/assets/4b-system-graphic.png";
import innerCircleWheel from "@/assets/inner-circle-wheel.png";

const features = [
  {
    icon: Video,
    title: "Full Video Library",
    description: "200+ exclusive drill videos organized by the 4B System. New content added weekly.",
    color: "text-purple-400",
    bg: "bg-purple-500/10 border-purple-500/20",
  },
  {
    icon: Calendar,
    title: "Weekly Live Calls",
    description:
      "Every Monday at 7pm CST. Group Q&A sessions with Coach Rick. Get your swing questions answered in real-time.",
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
  },
  {
    icon: ChartBar,
    title: "Unlimited Swing Reviews",
    description: "Submit swings anytime. Get 4B analysis and personalized drill prescriptions.",
    color: "text-green-400",
    bg: "bg-green-500/10 border-green-500/20",
  },
  {
    icon: MessageCircle,
    title: "Direct Access",
    description: "Text Coach Rick directly with questions. Priority response within 24 hours.",
    color: "text-orange-400",
    bg: "bg-orange-500/10 border-orange-500/20",
  },
  {
    icon: Users,
    title: "Private Community",
    description: "Connect with other serious players and coaches. Share wins, get feedback.",
    color: "text-pink-400",
    bg: "bg-pink-500/10 border-pink-500/20",
  },
  {
    icon: Percent,
    title: "Member Discounts",
    description: "20% off in-person assessments, camps, and any future products.",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10 border-yellow-500/20",
  },
];

const whoIsThisFor = [
  "You're serious about making varsity, college, or pro ball",
  "You want ongoing coaching, not just a one-time analysis",
  "You're willing to put in the work between sessions",
  "You want direct access when you have questions",
  "You're a coach looking to level up your knowledge",
];

const testimonials = [
  {
    quote:
      "The monthly calls alone are worth it. Getting real-time feedback on my son's swing has been a game-changer.",
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
    answer:
      "Yes. No contracts, no commitments. Cancel with one click anytime from your account settings. You'll keep access until the end of your billing period.",
  },
  {
    question: "How do the live calls work?",
    answer:
      "We do group Zoom calls every Monday at 7pm CST. You can submit swings beforehand or ask questions live. Calls are recorded if you can't make it.",
  },
  {
    question: "How quickly will Coach Rick respond?",
    answer:
      "Priority members get responses within 24 hours, usually much faster. For urgent game-day questions, same-day responses are common.",
  },
  {
    question: "Is this for kids or adults?",
    answer:
      "Both. The 4B System works for any age. We have members from 10-year-olds to adult rec league players to coaches in their 60s.",
  },
  {
    question: "What if I'm already a customer?",
    answer:
      "Any previous purchases ($37 or $97) count toward your first month. Just email us after joining for a credit.",
  },
];

const comparisonData = [
  { feature: "4B Swing Analysis", single: "1 swing", complete: "5 swings", inner: "Unlimited" },
  { feature: "Video Library Access", single: "Limited", complete: "30 days", inner: "Full access" },
  { feature: "Drill Prescription", single: "1 drill", complete: "30-day plan", inner: "Ongoing plans" },
  { feature: "Direct Access to Coach Rick", single: false, complete: false, inner: true },
  { feature: "Weekly Live Calls", single: false, complete: false, inner: true },
  { feature: "Private Community", single: false, complete: false, inner: true },
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
      <section className="relative pt-24 pb-20 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-yellow-900/20 via-transparent to-transparent" />

        {/* Animated particles/grid */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/10 border border-yellow-500/20 mb-6">
              <Crown className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-semibold text-yellow-400 uppercase tracking-wider">Premium Membership</span>
            </div>

            <h1 className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tight">
              JOIN THE <span className="text-yellow-400">INNER CIRCLE</span>
            </h1>

            <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
              Get unlimited access to Coach Rick, 200+ drill videos, weekly live calls, and a private community of
              serious players.
            </p>

            {/* Price Card */}
            <div className="relative inline-block">
              <div className="absolute -inset-1 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-2xl blur opacity-30" />
              <div className="relative bg-slate-900 border border-yellow-500/30 rounded-2xl p-8">
                <div className="flex items-baseline justify-center gap-2 mb-2">
                  <span className="text-5xl md:text-6xl font-black text-white">$297</span>
                  <span className="text-xl text-slate-400">/month</span>
                </div>
                <p className="text-slate-400 mb-6">Cancel anytime. No contracts.</p>

                {/* Email + CTA */}
                <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 h-12"
                  />
                  <Button
                    onClick={handleCheckout}
                    disabled={isLoading}
                    className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold h-12 px-8 whitespace-nowrap"
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        Join Now
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>

                {/* Trust badges */}
                <div className="flex items-center justify-center gap-6 mt-6 text-sm text-slate-500">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-green-500" />
                    30-Day Guarantee
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    Cancel Anytime
                  </div>
                </div>
              </div>
            </div>

            {/* Scroll indicator */}
            <div className="mt-12 animate-bounce">
              <ChevronDown className="w-6 h-6 text-slate-500 mx-auto" />
            </div>
          </div>
        </div>
      </section>

      {/* ===== FEATURES SECTION ===== */}
      <section className="py-20 bg-slate-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
              EVERYTHING YOU <span className="text-yellow-400">GET</span>
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Six powerful tools to accelerate your hitting development
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <div
                key={i}
                className="group p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-all duration-300"
              >
                <div className={`inline-flex p-3 rounded-xl ${feature.bg} border mb-4`}>
                  <feature.icon className={`w-6 h-6 ${feature.color}`} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-slate-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== COMPARISON TABLE ===== */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
              COMPARE <span className="text-yellow-400">OPTIONS</span>
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-4 px-4 text-slate-400 font-medium">Feature</th>
                  <th className="text-center py-4 px-4">
                    <div className="text-slate-400 font-medium">Single Swing</div>
                    <div className="text-white font-bold">$37</div>
                  </th>
                  <th className="text-center py-4 px-4">
                    <div className="text-slate-400 font-medium">Complete Review</div>
                    <div className="text-white font-bold">$97</div>
                  </th>
                  <th className="text-center py-4 px-4">
                    <div className="relative">
                      <div className="absolute -inset-2 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-xl blur" />
                      <div className="relative">
                        <div className="text-yellow-400 font-medium">Inner Circle</div>
                        <div className="text-white font-bold">$297/mo</div>
                      </div>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisonData.map((row, i) => (
                  <tr key={i} className="border-b border-slate-800/50">
                    <td className="py-4 px-4 text-slate-300">{row.feature}</td>
                    <td className="text-center py-4 px-4">
                      {typeof row.single === "boolean" ? (
                        row.single ? (
                          <Check className="w-5 h-5 text-green-500 mx-auto" />
                        ) : (
                          <X className="w-5 h-5 text-slate-600 mx-auto" />
                        )
                      ) : (
                        <span className="text-slate-400">{row.single}</span>
                      )}
                    </td>
                    <td className="text-center py-4 px-4">
                      {typeof row.complete === "boolean" ? (
                        row.complete ? (
                          <Check className="w-5 h-5 text-green-500 mx-auto" />
                        ) : (
                          <X className="w-5 h-5 text-slate-600 mx-auto" />
                        )
                      ) : (
                        <span className="text-slate-400">{row.complete}</span>
                      )}
                    </td>
                    <td className="text-center py-4 px-4">
                      {typeof row.inner === "boolean" ? (
                        row.inner ? (
                          <Check className="w-5 h-5 text-yellow-400 mx-auto" />
                        ) : (
                          <X className="w-5 h-5 text-slate-600 mx-auto" />
                        )
                      ) : (
                        <span className="text-yellow-400 font-semibold">{row.inner}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ===== WHO IS THIS FOR ===== */}
      <section className="py-20 bg-slate-900/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
              IS THIS <span className="text-yellow-400">FOR YOU?</span>
            </h2>
            <p className="text-lg text-slate-400">The Inner Circle is perfect if...</p>
          </div>

          <div className="space-y-4">
            {whoIsThisFor.map((item, i) => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center">
                  <Check className="w-4 h-4 text-yellow-400" />
                </div>
                <span className="text-white text-lg">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== TESTIMONIALS ===== */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
              MEMBER <span className="text-yellow-400">REVIEWS</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, i) => (
              <div key={i} className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
                {/* Stars */}
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, j) => (
                    <Star key={j} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>

                <p className="text-slate-300 mb-6 text-lg italic">"{testimonial.quote}"</p>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-white font-bold">
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
      <section className="py-20 bg-slate-900/30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
              COMMON <span className="text-yellow-400">QUESTIONS</span>
            </h2>
          </div>

          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="bg-slate-900/50 border border-slate-800 rounded-xl px-6 data-[state=open]:border-slate-700"
              >
                <AccordionTrigger className="text-white text-left font-semibold hover:no-underline py-4">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-slate-400 pb-4">{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ===== FINAL CTA ===== */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-5xl font-black text-white mb-6">
            READY TO <span className="text-yellow-400">LEVEL UP?</span>
          </h2>
          <p className="text-lg text-slate-400 mb-8 max-w-2xl mx-auto">
            Join hundreds of players and coaches who are transforming their swings with the Inner Circle.
          </p>

          {/* Price reminder */}
          <div className="relative inline-block mb-8">
            <div className="absolute -inset-1 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-2xl blur opacity-30" />
            <div className="relative bg-slate-900 border border-yellow-500/30 rounded-2xl p-8">
              <div className="flex items-baseline justify-center gap-2 mb-4">
                <span className="text-4xl font-black text-white">$297</span>
                <span className="text-lg text-slate-400">/month</span>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto mb-4">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 h-12"
                />
                <Button
                  onClick={handleCheckout}
                  disabled={isLoading}
                  className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold h-12 px-8 whitespace-nowrap"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Join Inner Circle
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>

              <div className="flex items-center justify-center gap-6 text-sm text-slate-500">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-green-500" />
                  30-Day Money-Back Guarantee
                </div>
              </div>
            </div>
          </div>

          <p className="text-slate-500 text-sm">
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
