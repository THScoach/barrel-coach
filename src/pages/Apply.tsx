import { useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, CheckCircle, Zap, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Apply() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    level: "",
    team: "",
    frustration: "",
    commitment: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.level || !formData.frustration) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);

    try {
      // Store application in database
      const { error } = await supabase.from("chat_logs").insert({
        messages: formData as any,
        page_url: "/apply",
        is_feedback: false,
        feedback_type: "90day_application",
      });

      if (error) throw error;

      setIsSubmitted(true);
      toast.success("Application submitted successfully!");
    } catch (error) {
      console.error("Failed to submit:", error);
      toast.error("Failed to submit application. Please try again.");
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
            <div className="w-20 h-20 bg-green-500/20 rounded-full mx-auto mb-8 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-400" />
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-white mb-4">
              APPLICATION RECEIVED
            </h1>
            <p className="text-lg text-slate-300 mb-6">
              I'll personally review your application within 48 hours. If it's a fit, I'll reach out to schedule a call.
            </p>
            <p className="text-slate-400 mb-8">
              This program isn't for everyone — that's by design. If I can help you, you'll hear from me.
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
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-full mb-6">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-bold text-yellow-400 uppercase tracking-wider">90-Day Transformation</span>
          </div>
          
          <h1 className="text-3xl md:text-5xl font-black text-white mb-6">
            APPLY NOW
          </h1>
          
          <p className="text-lg text-slate-300 mb-4">
            This is my flagship program. Not a course. Not a subscription. Real coaching over 90 days.
          </p>
          <p className="text-slate-400">
            I review every application personally. This is for serious players only — not everyone is accepted.
          </p>
        </div>
      </section>

      {/* Form */}
      <section className="pb-20">
        <div className="max-w-xl mx-auto px-4">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 space-y-6">
              
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

              <div className="space-y-2">
                <Label htmlFor="team" className="text-white">Current Team (optional)</Label>
                <Input
                  id="team"
                  value={formData.team}
                  onChange={(e) => setFormData({ ...formData, team: e.target.value })}
                  placeholder="Team name, school, or organization"
                  className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="frustration" className="text-white">
                  What's your #1 frustration at the plate? *
                </Label>
                <Textarea
                  id="frustration"
                  value={formData.frustration}
                  onChange={(e) => setFormData({ ...formData, frustration: e.target.value })}
                  placeholder="Be specific. What's been holding you back?"
                  className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 min-h-[100px]"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="commitment" className="text-white">
                  What are you committed to doing weekly? (optional)
                </Label>
                <Textarea
                  id="commitment"
                  value={formData.commitment}
                  onChange={(e) => setFormData({ ...formData, commitment: e.target.value })}
                  placeholder="How much time can you dedicate to training?"
                  className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 min-h-[80px]"
                />
              </div>

              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold h-14 text-lg"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Submit Application
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>
              </div>

            </div>

            <p className="text-center text-sm text-slate-500">
              Founders / Offseason Rate: $1,299 (limited) • Standard: $1,997–$2,997
            </p>
          </form>
        </div>
      </section>

      <Footer />
    </div>
  );
}
