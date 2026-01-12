import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
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
import { Loader2, CheckCircle, Zap, Crown, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type ApplicationTier = "group" | "1on1";

const tierConfig = {
  group: {
    title: "90-Day Small Group",
    subtitle: "Max 3 players per group",
    price: "$1,299",
    icon: Zap,
    iconColor: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/20",
    buttonColor: "bg-red-600 hover:bg-red-700",
    feedbackType: "group_application",
  },
  "1on1": {
    title: "1-on-1 Coaching",
    subtitle: "Direct access to Rick Strickland",
    price: "$2,997",
    icon: Crown,
    iconColor: "text-yellow-400",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/20",
    buttonColor: "bg-yellow-500 hover:bg-yellow-600 text-black",
    feedbackType: "1on1_application",
  },
};

export default function Apply() {
  const [searchParams] = useSearchParams();
  const tierParam = searchParams.get("tier") as ApplicationTier | null;
  const tier: ApplicationTier = tierParam === "1on1" ? "1on1" : "group";
  const config = tierConfig[tier];
  const IconComponent = config.icon;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    age: "",
    level: "",
    team: "",
    frustration: "",
    whyNow: "",
    parentEmail: "",
  });

  const isMinor = formData.age && parseInt(formData.age) < 18;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const requiredFields = tier === "1on1" 
      ? ["name", "email", "age", "level", "frustration", "whyNow"]
      : ["name", "email", "age", "level", "frustration"];
    
    const missingFields = requiredFields.filter(field => !formData[field as keyof typeof formData]);
    
    if (missingFields.length > 0) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (isMinor && !formData.parentEmail) {
      toast.error("Parent/guardian email is required for players under 18");
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from("chat_logs").insert({
        messages: { ...formData, tier } as any,
        page_url: `/apply?tier=${tier}`,
        is_feedback: false,
        feedback_type: config.feedbackType,
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
              If it's a fit, you'll hear from Rick.
            </p>
            <p className="text-slate-400 mb-8">
              {tier === "1on1" 
                ? "1-on-1 coaching spots are extremely limited. I review every application personally and only accept players I know I can help."
                : "I'll review your application within 48 hours. The 90-Day Small Group is limited to 3 players — that's by design."}
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
          <div className={`inline-flex items-center gap-2 px-4 py-2 ${config.bgColor} border ${config.borderColor} rounded-full mb-6`}>
            <IconComponent className={`w-4 h-4 ${config.iconColor}`} />
            <span className={`text-sm font-bold ${config.iconColor} uppercase tracking-wider`}>
              {tier === "1on1" ? "Private Coaching" : "Development Program"}
            </span>
          </div>
          
          <h1 className="text-3xl md:text-5xl font-black text-white mb-4">
            {config.title}
          </h1>
          
          <div className="text-4xl font-black text-white mb-2">{config.price}</div>
          <p className="text-slate-400 mb-6">{config.subtitle}</p>
          
          <p className="text-lg text-slate-300">
            {tier === "1on1" 
              ? "This is the ONLY way to access Rick directly. Not everyone is accepted."
              : "Real coaching over 90 days. Not a course. Not a subscription."}
          </p>
        </div>
      </section>

      {/* Form */}
      <section className="pb-20">
        <div className="max-w-xl mx-auto px-4">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 space-y-6">
              
              {/* Name & Email */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-white">Player Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Full name"
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

              {/* Age & Level */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="age" className="text-white">Age *</Label>
                  <Input
                    id="age"
                    type="number"
                    min="8"
                    max="50"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    placeholder="Player age"
                    className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                    required
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

              {/* Parent Email (conditional) */}
              {isMinor && (
                <div className="space-y-2">
                  <Label htmlFor="parentEmail" className="text-white">Parent/Guardian Email *</Label>
                  <Input
                    id="parentEmail"
                    type="email"
                    value={formData.parentEmail}
                    onChange={(e) => setFormData({ ...formData, parentEmail: e.target.value })}
                    placeholder="parent@email.com"
                    className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                    required
                  />
                  <p className="text-xs text-slate-500">Required for players under 18</p>
                </div>
              )}

              {/* Phone & Team */}
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
                  <Label htmlFor="team" className="text-white">Current Team (optional)</Label>
                  <Input
                    id="team"
                    value={formData.team}
                    onChange={(e) => setFormData({ ...formData, team: e.target.value })}
                    placeholder="Team or school"
                    className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                  />
                </div>
              </div>

              {/* Frustration */}
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

              {/* Why Now (1-on-1 only) */}
              {tier === "1on1" && (
                <div className="space-y-2">
                  <Label htmlFor="whyNow" className="text-white">
                    Why 1-on-1? Why now? *
                  </Label>
                  <Textarea
                    id="whyNow"
                    value={formData.whyNow}
                    onChange={(e) => setFormData({ ...formData, whyNow: e.target.value })}
                    placeholder="What makes you ready for this level of commitment?"
                    className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 min-h-[100px]"
                    required
                  />
                </div>
              )}

              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full ${config.buttonColor} font-bold h-14 text-lg`}
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

              <p className="text-center text-xs text-slate-500">
                No payment required. Applications are reviewed manually.
              </p>
            </div>
          </form>
        </div>
      </section>

      <Footer />
    </div>
  );
}
