import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare, Shield, Phone, Ban, CheckCircle2, Mail } from "lucide-react";

export default function Consent() {
  return (
    <div className="min-h-screen bg-slate-950">
      <Header />
      
      <main className="pt-24 pb-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-600/20 border border-red-600/30 mb-6">
              <MessageSquare className="h-8 w-8 text-red-500" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              SMS Communication Consent
            </h1>
            <p className="text-lg text-slate-400">
              Catching Barrels Swing Lab - Mobile Messaging Terms
            </p>
          </div>

          <div className="space-y-6">
            {/* Consent Collection Explanation */}
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-600/20 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-3">How We Collect Consent</h2>
                    <p className="text-slate-300 leading-relaxed">
                      When you sign up for Catching Barrels services or provide your phone number during registration, 
                      you are asked to consent to receive SMS communications. This consent is collected through our 
                      online registration forms and in-person sign-up process. Your consent is recorded and stored 
                      securely in our system.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Consent Text */}
            <Card className="bg-slate-900 border-red-600/50 border-2">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-600/20 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-3">Consent Statement</h2>
                    <blockquote className="text-slate-200 leading-relaxed bg-slate-800/50 p-4 rounded-lg border-l-4 border-red-600 italic">
                      "I agree to receive SMS messages from Catching Barrels regarding my swing analysis results, 
                      training updates, and coaching communications. Message frequency varies. Msg and data rates 
                      may apply. Reply STOP to opt out."
                    </blockquote>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Message Types */}
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-600/20 flex items-center justify-center">
                    <Phone className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-3">Types of Messages</h2>
                    <p className="text-slate-300 mb-4">
                      By opting in, you may receive the following types of SMS messages:
                    </p>
                    <ul className="space-y-2">
                      {[
                        "4B Score updates and swing analysis results",
                        "Personalized drill recommendations based on your performance",
                        "Training tips and coaching insights from Coach Rick",
                        "Session reminders and scheduling notifications",
                        "Video assignments and practice plan updates",
                        "Important account and service notifications"
                      ].map((item, index) => (
                        <li key={index} className="flex items-start gap-3 text-slate-300">
                          <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-red-500 mt-2" />
                          {item}
                        </li>
                      ))}
                    </ul>
                    <p className="text-slate-400 mt-4 text-sm">
                      Message frequency varies based on your training activity and session schedule.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Opt-Out Instructions */}
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-600/20 flex items-center justify-center">
                    <Ban className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-3">How to Opt Out</h2>
                    <p className="text-slate-300 leading-relaxed mb-4">
                      You can opt out of receiving SMS messages at any time. Simply reply to any message with:
                    </p>
                    <div className="flex gap-4 mb-4">
                      <div className="bg-slate-800 px-4 py-2 rounded-lg border border-slate-700">
                        <span className="font-mono font-bold text-red-500">STOP</span>
                        <span className="text-slate-400 text-sm ml-2">— Unsubscribe</span>
                      </div>
                      <div className="bg-slate-800 px-4 py-2 rounded-lg border border-slate-700">
                        <span className="font-mono font-bold text-green-500">START</span>
                        <span className="text-slate-400 text-sm ml-2">— Resubscribe</span>
                      </div>
                    </div>
                    <p className="text-slate-300 leading-relaxed">
                      Once you reply STOP, you will receive a confirmation message and will no longer receive 
                      SMS communications from us. To resume messages, reply START or contact us directly.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contact Information */}
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-600/20 flex items-center justify-center">
                    <Mail className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-3">Contact Us</h2>
                    <p className="text-slate-300 leading-relaxed mb-4">
                      For questions about our SMS messaging program or to manage your preferences:
                    </p>
                    <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 space-y-2">
                      <p className="text-white font-semibold">Diamond Sciences, LLC</p>
                      <p className="text-slate-300">
                        Email:{" "}
                        <a 
                          href="mailto:swingrehabcoach@gmail.com" 
                          className="text-red-500 hover:text-red-400 hover:underline transition-colors"
                        >
                          swingrehabcoach@gmail.com
                        </a>
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Footer Note */}
            <div className="text-center text-sm text-slate-500 pt-6 border-t border-slate-800">
              <p>
                By signing up for our services and providing your phone number, you acknowledge 
                that you have read and agree to these SMS messaging terms.
              </p>
              <p className="mt-3 text-slate-600">
                © {new Date().getFullYear()} Diamond Sciences, LLC • Catching Barrels Swing Lab
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
