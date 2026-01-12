import { useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Check, 
  Users, 
  Video, 
  MessageCircle, 
  Calendar, 
  Loader2, 
  Shield,
  ArrowRight 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const includes = [
  { icon: Calendar, text: "Weekly Monday night live group call with Rick" },
  { icon: Video, text: "Swing uploads with personal feedback" },
  { icon: MessageCircle, text: "SMS communication directly with Rick" },
  { icon: Users, text: "Ongoing coaching throughout the month" },
];

const faqs = [
  { 
    question: "What happens on Monday calls?", 
    answer: "Each week I cover concepts, review swings from the group, answer questions live, and keep everyone accountable. It's coaching, not a webinar." 
  },
  { 
    question: "How do I upload my swing?", 
    answer: "You'll get access to the Catching Barrels dashboard where you can upload videos directly. I'll review and respond with feedback." 
  },
  { 
    question: "Can I cancel anytime?", 
    answer: "Yes. Cancel anytime with no questions asked. No contracts, no commitments." 
  },
  { 
    question: "Is this 1-on-1 coaching?", 
    answer: "No — this is group coaching with personal feedback. For 1-on-1, book an in-person assessment." 
  },
  { 
    question: "What level is this for?", 
    answer: "Youth, high school, college, or pro. The principles apply at every level. I tailor feedback to where you are." 
  },
];

export default function Coaching() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleJoin = async () => {
    if (!email || !email.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-coaching-checkout", { 
        body: { email } 
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (error) {
      console.error("Checkout failed:", error);
      toast.error("Failed to start checkout. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <Header />

      {/* Hero */}
      <section className="pt-32 pb-20">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-full mb-6">
              <Users className="w-4 h-4 text-red-400" />
              <span className="text-sm font-bold text-red-400 uppercase tracking-wider">
                Primary Offer
              </span>
            </div>

            <h1 className="text-4xl md:text-6xl font-black text-white mb-6">
              ONLINE COACHING
            </h1>

            <p className="text-xl text-slate-300 max-w-2xl mx-auto mb-4">
              Weekly calls. Swing feedback. Direct access to me.
            </p>
            <p className="text-lg text-slate-400 max-w-xl mx-auto">
              This is how I coach hitters — ongoing, consistent, accountable.
            </p>
          </div>

          {/* Pricing Card */}
          <div className="bg-slate-900/80 border-2 border-red-500/50 rounded-2xl p-8 max-w-md mx-auto mb-16 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-red-600 rounded-full text-xs font-bold text-white uppercase tracking-wider">
              Main Program
            </div>
            <div className="text-center mb-6">
              <p className="text-5xl font-black text-white mb-2">$99<span className="text-xl text-slate-400">/month</span></p>
              <p className="text-slate-400">Cancel anytime. No contracts.</p>
            </div>

            <Input
              type="email"
              placeholder="Enter your email to join"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 mb-4"
            />
            
            <Button 
              onClick={handleJoin} 
              disabled={isLoading} 
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold h-14 text-lg"
            >
              {isLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>
              ) : (
                <>Join Online Coaching <ArrowRight className="ml-2 h-4 w-4" /></>
              )}
            </Button>
            
            <div className="flex items-center justify-center gap-2 mt-4 text-sm text-slate-400">
              <Shield className="w-4 h-4 text-green-400" />
              Secure checkout via Stripe
            </div>
          </div>

          {/* What's Included */}
          <div className="mb-16">
            <h2 className="text-2xl font-bold text-white text-center mb-8">What's Included</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {includes.map((item, index) => (
                <div key={index} className="flex items-center gap-4 bg-slate-900/80 border border-slate-800 p-5 rounded-xl">
                  <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-5 h-5 text-red-400" />
                  </div>
                  <span className="text-slate-200">{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* How It Works */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 mb-16">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">How It Works</h2>
            <div className="space-y-4 text-slate-300">
              <p><strong className="text-white">1. Sign up.</strong> You get instant access to the dashboard.</p>
              <p><strong className="text-white">2. Upload your swing.</strong> I'll review it and send feedback.</p>
              <p><strong className="text-white">3. Join Monday calls.</strong> Every week. Live with me.</p>
              <p><strong className="text-white">4. Text me.</strong> Questions? Updates? I'm a message away.</p>
            </div>
          </div>

          {/* FAQ */}
          <div className="mb-16">
            <h2 className="text-2xl font-bold text-white text-center mb-8">Questions?</h2>
            <Accordion type="single" collapsible className="space-y-3">
              {faqs.map((faq, index) => (
                <AccordionItem 
                  key={index} 
                  value={`item-${index}`} 
                  className="bg-slate-900/80 border border-slate-800 rounded-xl px-6"
                >
                  <AccordionTrigger className="text-left font-semibold text-white hover:no-underline py-4">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-slate-400 pb-4">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          {/* Final CTA */}
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-4">Ready to get coached?</h2>
            <p className="text-slate-400 mb-6">Join today. First call is this Monday.</p>
            <Button 
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="bg-red-600 hover:bg-red-700 text-white font-bold h-14 px-10 text-lg"
            >
              Join for $99/month <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
