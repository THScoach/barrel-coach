import { useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, ArrowLeft, Target, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Quiz questions
const quizQuestions = [
  {
    id: 1,
    question: "When you walk naturally, do you tend to...",
    options: [
      { id: "a", text: "Walk on your heels, grounded and stable", profile: "spinner" },
      { id: "b", text: "Walk on your toes, light and bouncy", profile: "slingshotter" },
    ],
  },
  {
    id: 2,
    question: "When you swing and miss, where do you usually feel off-balance?",
    options: [
      { id: "a", text: "I spin out and fall toward third base (RHH) / first base (LHH)", profile: "spinner" },
      { id: "b", text: "I lunge forward and fall toward the pitcher", profile: "slingshotter" },
      { id: "c", text: "I feel stuck on my back side", profile: "whipper" },
    ],
  },
  {
    id: 3,
    question: "Which drill feels more natural to you?",
    options: [
      { id: "a", text: "Staying compact and rotating in place", profile: "spinner" },
      { id: "b", text: "Driving hard off my back leg toward the pitcher", profile: "slingshotter" },
      { id: "c", text: "Bracing my front leg and letting my hands whip through", profile: "whipper" },
    ],
  },
  {
    id: 4,
    question: "Watch a slow-motion video of yourself. Does your barrel...",
    options: [
      { id: "a", text: "Stay close to your body through the zone", profile: "spinner" },
      { id: "b", text: "Release way out in front, extended", profile: "whipper" },
    ],
  },
  {
    id: 5,
    question: "How would you describe your body type?",
    options: [
      { id: "a", text: "Shorter, stocky, compact build", profile: "spinner" },
      { id: "b", text: "Taller, leaner, longer limbs", profile: "whipper" },
      { id: "c", text: "Average/athletic build", profile: "slingshotter" },
    ],
  },
];

// Motor profile results
const motorProfiles = {
  spinner: {
    name: "SPINNER",
    emoji: "🌀",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/40",
    glowColor: "shadow-blue-500/20",
    headline: "You're a SPINNER",
    description: "Your swing is powered by rotation. You generate bat speed through tight, compact turns with your core as the engine. Think José Ramírez or Mookie Betts — quick hands, explosive hip rotation, and a swing that stays inside the ball.",
    strengths: [
      "Quick bat-to-ball",
      "Handles inside pitches well",
      "Compact swing = less holes",
      "Great for gap-to-gap power",
    ],
    watchOuts: [
      "Can get too rotational (spinning out)",
      "Struggles extending on outside pitches",
      "May sacrifice power for contact",
    ],
    drillFocus: "Work on maintaining posture through rotation and adding extension without losing your compact path.",
  },
  slingshotter: {
    name: "SLINGSHOTTER",
    emoji: "🎯",
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/40",
    glowColor: "shadow-orange-500/20",
    headline: "You're a SLINGSHOTTER",
    description: "Your swing is powered by momentum and linear drive. You load up and fire forward like a slingshot, using your legs to drive energy toward the pitcher. Think Aaron Judge or Shohei Ohtani — powerful leg drive, extension through contact, and raw force.",
    strengths: [
      "Tremendous raw power potential",
      "Drives the ball to all fields",
      "Great extension through the zone",
      "Built for game power (HR)",
    ],
    watchOuts: [
      "Can lunge and get out front",
      "Struggles with timing on off-speed",
      "More swing-and-miss risk",
    ],
    drillFocus: "Work on staying back longer, using ground force efficiently, and quieting the upper body in the load.",
  },
  whipper: {
    name: "WHIPPER",
    emoji: "⚡",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/40",
    glowColor: "shadow-yellow-500/20",
    headline: "You're a WHIPPER",
    description: "Your swing is powered by elite hand speed and barrel whip. You create bat speed late, using leverage and sequencing to release the barrel at the last moment. Think Freddie Freeman or Corey Seager — smooth mechanics, explosive barrel release, and effortless power.",
    strengths: [
      "Elite bat speed potential",
      "Smooth, repeatable swing",
      "Adjustability mid-swing",
      "Covers the whole plate",
    ],
    watchOuts: [
      "Can get long if hands drift",
      "Timing-dependent (struggles when rushed)",
      "May leave barrel in zone too long",
    ],
    drillFocus: "Work on earlier hand initiation and staying connected through the zone without sacrificing your natural whip.",
  },
};

type MotorProfileType = keyof typeof motorProfiles;

// Calculate motor profile from quiz answers
function calculateMotorProfile(answers: Record<number, string>): MotorProfileType {
  const scores: Record<MotorProfileType, number> = {
    spinner: 0,
    slingshotter: 0,
    whipper: 0,
  };

  // Count answers by profile type
  Object.entries(answers).forEach(([questionId, answerId]) => {
    const question = quizQuestions.find((q) => q.id === parseInt(questionId));
    if (question) {
      const selectedOption = question.options.find((o) => o.id === answerId);
      if (selectedOption) {
        scores[selectedOption.profile as MotorProfileType]++;
      }
    }
  });

  // Find the profile with the highest score
  let maxProfile: MotorProfileType = "spinner";
  let maxScore = 0;

  Object.entries(scores).forEach(([profile, score]) => {
    if (score > maxScore) {
      maxScore = score;
      maxProfile = profile as MotorProfileType;
    }
  });

  return maxProfile;
}

export default function Diagnostic() {
  const [step, setStep] = useState<"quiz" | "capture" | "result">("quiz");
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [formData, setFormData] = useState({
    firstName: "",
    email: "",
    phone: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [motorProfile, setMotorProfile] = useState<MotorProfileType | null>(null);

  const handleAnswer = (questionId: number, answerId: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answerId }));

    // Auto-advance after a short delay
    setTimeout(() => {
      if (currentQuestion < quizQuestions.length - 1) {
        setCurrentQuestion((prev) => prev + 1);
      } else {
        // Quiz complete, move to capture
        setStep("capture");
      }
    }, 300);
  };

  const handlePreviousQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion((prev) => prev - 1);
    }
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.firstName.trim() || !formData.email.trim() || !formData.phone.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsSubmitting(true);

    try {
      // Calculate motor profile
      const profile = calculateMotorProfile(answers);
      setMotorProfile(profile);

      // Save to database
      const { error } = await supabase.from("players").insert({
        name: formData.firstName.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        motor_profile_sensor: profile,
        account_status: "lead",
        notes: `Motor Profile Quiz: ${JSON.stringify(answers)}`,
      });

      if (error) {
        console.error("Error saving lead:", error);
        // Still show result even if save fails
      }

      // Move to result
      setStep("result");
    } catch (err) {
      console.error("Unexpected error:", err);
      // Still show result
      const profile = calculateMotorProfile(answers);
      setMotorProfile(profile);
      setStep("result");
    } finally {
      setIsSubmitting(false);
    }
  };

  const progress = ((currentQuestion + 1) / quizQuestions.length) * 100;
  const question = quizQuestions[currentQuestion];

  return (
    <div className="min-h-screen bg-slate-950">
      <Header />

      <section className="pt-28 pb-20">
        <div className="max-w-2xl mx-auto px-4">
          {/* Step: Quiz */}
          {step === "quiz" && (
            <div className="space-y-8">
              {/* Header */}
              <div className="text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20 mb-6">
                  <Target className="w-4 h-4 text-red-400" />
                  <span className="text-sm font-bold text-red-400 uppercase tracking-wider">
                    Kinetic DNA Diagnostic
                  </span>
                </div>
                <h1 className="text-3xl md:text-4xl font-black text-white mb-3">
                  DISCOVER YOUR <span className="text-red-500">MOTOR PROFILE</span>
                </h1>
                <p className="text-lg text-slate-400">
                  Answer 5 quick questions to find out how your body naturally generates bat speed.
                </p>
              </div>

              {/* Progress bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-slate-500">
                  <span>Question {currentQuestion + 1} of {quizQuestions.length}</span>
                  <span>{Math.round(progress)}% complete</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-red-500 to-red-600 transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Question Card */}
              <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-6 md:p-8">
                <h2 className="text-xl md:text-2xl font-bold text-white mb-6">
                  {question.question}
                </h2>

                <div className="space-y-3">
                  {question.options.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => handleAnswer(question.id, option.id)}
                      className={cn(
                        "w-full text-left p-4 rounded-xl border-2 transition-all duration-200",
                        answers[question.id] === option.id
                          ? "bg-red-500/20 border-red-500 text-white"
                          : "bg-slate-800/50 border-slate-700 text-slate-300 hover:border-slate-600 hover:bg-slate-800"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm",
                            answers[question.id] === option.id
                              ? "bg-red-500 text-white"
                              : "bg-slate-700 text-slate-400"
                          )}
                        >
                          {option.id.toUpperCase()}
                        </div>
                        <span className="text-base">{option.text}</span>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Navigation */}
                {currentQuestion > 0 && (
                  <div className="mt-6 pt-6 border-t border-slate-800">
                    <Button
                      variant="ghost"
                      onClick={handlePreviousQuestion}
                      className="text-slate-400 hover:text-white"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Previous
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step: Capture Form */}
          {step === "capture" && (
            <div className="space-y-8">
              {/* Header */}
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 border-2 border-green-500/40 mb-6">
                  <Check className="w-8 h-8 text-green-400" />
                </div>
                <h1 className="text-3xl md:text-4xl font-black text-white mb-3">
                  YOUR MOTOR PROFILE IS READY!
                </h1>
                <p className="text-lg text-slate-400">
                  Enter your info below and we'll reveal your result + text you the full diagnosis.
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmitForm} className="bg-slate-900/80 border border-slate-700 rounded-2xl p-6 md:p-8 space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="firstName" className="text-white font-medium">
                      First Name
                    </Label>
                    <Input
                      id="firstName"
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData((prev) => ({ ...prev, firstName: e.target.value }))}
                      placeholder="Enter your first name"
                      className="mt-2 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="email" className="text-white font-medium">
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                      placeholder="Enter your email"
                      className="mt-2 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="phone" className="text-white font-medium">
                      Phone Number
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                      placeholder="(555) 123-4567"
                      className="mt-2 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                      required
                    />
                    <p className="text-xs text-slate-500 mt-2">
                      📱 We'll text you your full diagnosis
                    </p>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold h-14 text-lg"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Revealing...
                    </>
                  ) : (
                    <>
                      Reveal My Motor Profile
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>
              </form>
            </div>
          )}

          {/* Step: Result */}
          {step === "result" && motorProfile && (
            <div className="space-y-8">
              {/* Result Card */}
              <div
                className={cn(
                  "rounded-2xl border-2 p-6 md:p-8 text-center",
                  motorProfiles[motorProfile].bgColor,
                  motorProfiles[motorProfile].borderColor,
                  `shadow-2xl ${motorProfiles[motorProfile].glowColor}`
                )}
              >
                <div className="text-6xl md:text-7xl mb-4">
                  {motorProfiles[motorProfile].emoji}
                </div>
                <h1 className={cn("text-3xl md:text-4xl font-black mb-2", motorProfiles[motorProfile].color)}>
                  {motorProfiles[motorProfile].headline}
                </h1>
                <p className="text-xl text-white font-bold">
                  Hey {formData.firstName}! 👋
                </p>
              </div>

              {/* Description */}
              <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-6 md:p-8 space-y-6">
                <p className="text-slate-300 text-lg leading-relaxed">
                  {motorProfiles[motorProfile].description}
                </p>

                {/* Strengths */}
                <div>
                  <h3 className="text-lg font-bold text-green-400 mb-3 flex items-center gap-2">
                    ✅ Your Strengths
                  </h3>
                  <ul className="space-y-2">
                    {motorProfiles[motorProfile].strengths.map((strength, i) => (
                      <li key={i} className="flex items-start gap-3 text-slate-300">
                        <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-1" />
                        {strength}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Watch Outs */}
                <div>
                  <h3 className="text-lg font-bold text-yellow-400 mb-3 flex items-center gap-2">
                    ⚠️ Watch Out For
                  </h3>
                  <ul className="space-y-2">
                    {motorProfiles[motorProfile].watchOuts.map((watchOut, i) => (
                      <li key={i} className="flex items-start gap-3 text-slate-300">
                        <span className="text-yellow-400 flex-shrink-0">•</span>
                        {watchOut}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Drill Focus */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
                  <h3 className="text-lg font-bold text-white mb-2">🎯 Your Training Focus</h3>
                  <p className="text-slate-400">{motorProfiles[motorProfile].drillFocus}</p>
                </div>
              </div>

              {/* CTA */}
              <div className="bg-gradient-to-r from-red-500/20 to-orange-500/10 border-2 border-red-500/40 rounded-2xl p-6 md:p-8 text-center">
                <h2 className="text-2xl font-bold text-white mb-3">
                  Ready to Train Like a {motorProfiles[motorProfile].name}?
                </h2>
                <p className="text-slate-400 mb-6">
                  Join The Academy and get personalized drills, weekly check-ins, and a FREE Smart Sensor Kit.
                </p>
                <Button
                  asChild
                  className="bg-red-600 hover:bg-red-700 text-white font-bold h-14 px-8 text-lg"
                >
                  <a href="/pricing">
                    Join The Academy — $99/mo
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </a>
                </Button>
              </div>

              {/* SMS Note */}
              <div className="text-center text-slate-500 text-sm">
                📱 Check your texts! We're sending your full diagnosis to {formData.phone}
              </div>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
