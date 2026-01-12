import { useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, CheckCircle, Users, ArrowRight, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Live() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    level: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.level) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from("chat_logs").insert({
        messages: formData as any,
        page_url: "/live",
        is_feedback: false,
        feedback_type: "live_signup",
      });

      if (error) throw error;

      setIsSubmitted(true);
      toast.success("You're on the list!");
    } catch (error) {
      console.error("Failed to submit:", error);
      toast.error("Failed to submit. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-slate-950">
        <Header />
        <section className="pt-32 pb-20">
          <div className="max-w-xl mx-auto px-4 text-center">
            <div className="w-20 h-20 bg-blue-500/20 rounded-full mx-auto mb-8 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-blue-400" />
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-white mb-4">
              YOU'RE ON THE LIST
            </h1>
            <p className="text-lg text-slate-300 mb-6">
              I'll send you details about the next Catching Barrels Live session.
            </p>
            <p className="text-slate-400 mb-8">
              Weekly calls. Group Q&A. Real accountability.
            </p>
            <p className="text-slate-500">— Rick</p>
          </div>
        </section>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <Header />

      {/* Hero */}
      <section className="pt-32 pb-12">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full mb-6">
            <Users className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-bold text-blue-400 uppercase tracking-wider">Ongoing Support</span>
          </div>
          
          <h1 className="text-3xl md:text-5xl font-black text-white mb-6">
            CATCHING BARRELS LIVE
          </h1>
          
          <div className="text-4xl font-black text-white mb-2">$99<span className="text-xl text-slate-400">/month</span></div>
          
          <p className="text-lg text-slate-300 mb-4">
            Weekly live calls. Group Q&A. Stay sharp, stay accountable.
          </p>
          <p className="text-slate-400">
            This is NOT a transformation program. It's ongoing support for players who want to keep learning.
          </p>
        </div>
      </section>

      {/* What's Included */}
      <section className="pb-12">
        <div className="max-w-xl mx-auto px-4">
          <div className="bg-slate-900/80 border border-blue-500/20 rounded-2xl p-8">
            <h3 className="text-xl font-bold text-white mb-6">What's Included</h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-3 text-slate-300">
                <Check className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                Weekly live group call (Monday nights)
              </li>
              <li className="flex items-start gap-3 text-slate-300">
                <Check className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                Group Q&A with Rick
              </li>
              <li className="flex items-start gap-3 text-slate-300">
                <Check className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                Ongoing education and insights
              </li>
              <li className="flex items-start gap-3 text-slate-300">
                <Check className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                Community access
              </li>
            </ul>
            
            <div className="mt-6 pt-6 border-t border-slate-700">
              <p className="text-sm text-slate-500">
                <strong className="text-slate-400">Note:</strong> This is a retention layer, not a development program. 
                For real transformation, apply for the 90-Day Small Group or 1-on-1 Coaching.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Form */}
      <section className="pb-20">
        <div className="max-w-xl mx-auto px-4">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 space-y-6">
              <h3 className="text-xl font-bold text-white">Join the Waitlist</h3>
              
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-white">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Your full name"
                    className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="your@email.com"
                    className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                    required
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-white">Phone (optional)</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(555) 123-4567"
                    className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="level" className="text-white">Level *</Label>
                  <Select
                    value={formData.level}
                    onValueChange={(value) => setFormData({ ...formData, level: value })}
                  >
                    <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white">
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700">
                      <SelectItem value="youth">Youth (12U)</SelectItem>
                      <SelectItem value="middle-school">Middle School (13-14)</SelectItem>
                      <SelectItem value="high-school">High School</SelectItem>
                      <SelectItem value="college">College</SelectItem>
                      <SelectItem value="pro">Professional</SelectItem>
                      <SelectItem value="adult">Adult Rec</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-14 text-lg"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Join Live Coaching — $99/mo
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </section>

      <Footer />
    </div>
  );
}
