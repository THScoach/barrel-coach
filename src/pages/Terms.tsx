import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Shield, Users, AlertTriangle, Scale, RefreshCw, Ban, Mail } from "lucide-react";

export default function Terms() {
  const lastUpdated = "January 23, 2026";

  return (
    <div className="min-h-screen bg-slate-950">
      <Header />
      
      <main className="pt-24 pb-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-600/20 border border-red-600/30 mb-6">
              <FileText className="h-8 w-8 text-red-500" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Terms of Service
            </h1>
            <p className="text-lg text-slate-400">
              Diamond Sciences, LLC — Catching Barrels Swing Lab
            </p>
            <p className="text-sm text-slate-500 mt-2">
              Last Updated: {lastUpdated}
            </p>
          </div>

          <div className="space-y-6">
            {/* Agreement to Terms */}
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-600/20 flex items-center justify-center">
                    <Scale className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-3">1. Agreement to Terms</h2>
                    <p className="text-slate-300 leading-relaxed">
                      By accessing or using the Catching Barrels Swing Lab services ("Services") provided by 
                      Diamond Sciences, LLC ("Company," "we," "us," or "our"), you agree to be bound by these 
                      Terms of Service. If you do not agree to these terms, please do not use our Services.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Description of Services */}
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-600/20 flex items-center justify-center">
                    <Users className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-3">2. Description of Services</h2>
                    <p className="text-slate-300 leading-relaxed mb-4">
                      Catching Barrels Swing Lab provides baseball swing analysis and coaching services, including:
                    </p>
                    <ul className="space-y-2">
                      {[
                        "4B Score biomechanical swing assessments (Brain, Body, Bat, Ball)",
                        "Video analysis and personalized drill recommendations",
                        "SMS and email coaching communications",
                        "Access to instructional video library and training content",
                        "Performance tracking and progress reports",
                        "In-person and remote coaching sessions"
                      ].map((item, index) => (
                        <li key={index} className="flex items-start gap-3 text-slate-300">
                          <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-red-500 mt-2" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* User Responsibilities */}
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-600/20 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-3">3. User Responsibilities</h2>
                    <p className="text-slate-300 leading-relaxed mb-4">
                      As a user of our Services, you agree to:
                    </p>
                    <ul className="space-y-2">
                      {[
                        "Provide accurate and complete information during registration",
                        "Maintain the confidentiality of your account credentials",
                        "Use the Services only for lawful purposes",
                        "Not share, resell, or redistribute our proprietary content",
                        "Ensure minors have parental/guardian consent before using Services",
                        "Follow all training recommendations safely and within your physical abilities"
                      ].map((item, index) => (
                        <li key={index} className="flex items-start gap-3 text-slate-300">
                          <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-red-500 mt-2" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Intellectual Property */}
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-600/20 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-3">4. Intellectual Property</h2>
                    <p className="text-slate-300 leading-relaxed mb-4">
                      All content, including but not limited to the 4B Scoring System, training methodologies, 
                      videos, graphics, and text, are the exclusive property of Diamond Sciences, LLC. You are 
                      granted a limited, non-exclusive, non-transferable license to access and use the Services 
                      for personal, non-commercial purposes only.
                    </p>
                    <p className="text-slate-300 leading-relaxed">
                      You may not copy, modify, distribute, sell, or lease any part of our Services or included 
                      content without prior written consent from Diamond Sciences, LLC.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Assumption of Risk */}
            <Card className="bg-slate-900 border-red-600/50 border-2">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-600/20 flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-3">5. Assumption of Risk & Disclaimer</h2>
                    <p className="text-slate-300 leading-relaxed mb-4">
                      Athletic training involves inherent risks of injury. By using our Services, you acknowledge 
                      and accept these risks. You agree to:
                    </p>
                    <ul className="space-y-2 mb-4">
                      {[
                        "Consult with a physician before beginning any training program",
                        "Perform all exercises and drills within your physical capabilities",
                        "Stop immediately if you experience pain or discomfort",
                        "Assume full responsibility for your participation in training activities"
                      ].map((item, index) => (
                        <li key={index} className="flex items-start gap-3 text-slate-300">
                          <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-red-500 mt-2" />
                          {item}
                        </li>
                      ))}
                    </ul>
                    <p className="text-slate-400 text-sm bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                      THE SERVICES ARE PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. DIAMOND SCIENCES, LLC 
                      DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY AND FITNESS FOR 
                      A PARTICULAR PURPOSE.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Limitation of Liability */}
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-600/20 flex items-center justify-center">
                    <Ban className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-3">6. Limitation of Liability</h2>
                    <p className="text-slate-300 leading-relaxed">
                      To the maximum extent permitted by law, Diamond Sciences, LLC shall not be liable for any 
                      indirect, incidental, special, consequential, or punitive damages, including but not limited 
                      to loss of profits, data, or other intangible losses, resulting from your use of or inability 
                      to use the Services. Our total liability shall not exceed the amount you paid for the Services 
                      in the twelve (12) months preceding the claim.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Modifications */}
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-600/20 flex items-center justify-center">
                    <RefreshCw className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-3">7. Modifications to Terms</h2>
                    <p className="text-slate-300 leading-relaxed">
                      We reserve the right to modify these Terms of Service at any time. Changes will be effective 
                      immediately upon posting to our website. Your continued use of the Services after any 
                      modifications constitutes acceptance of the updated terms. We encourage you to review these 
                      terms periodically.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Governing Law */}
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-600/20 flex items-center justify-center">
                    <Scale className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-3">8. Governing Law</h2>
                    <p className="text-slate-300 leading-relaxed">
                      These Terms of Service shall be governed by and construed in accordance with the laws of 
                      the State of Missouri, without regard to its conflict of law provisions. Any disputes 
                      arising under these terms shall be resolved in the state or federal courts located in 
                      St. Louis County, Missouri.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contact */}
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-600/20 flex items-center justify-center">
                    <Mail className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-3">9. Contact Us</h2>
                    <p className="text-slate-300 leading-relaxed mb-4">
                      If you have any questions about these Terms of Service, please contact us:
                    </p>
                    <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 space-y-2">
                      <p className="text-white font-semibold">Diamond Sciences, LLC</p>
                      <p className="text-slate-300">d/b/a Catching Barrels Swing Lab</p>
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

            {/* Footer */}
            <div className="text-center text-sm text-slate-500 pt-6 border-t border-slate-800">
              <p>
                By using our Services, you acknowledge that you have read, understood, and agree to be 
                bound by these Terms of Service.
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
