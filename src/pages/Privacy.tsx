import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Database, Share2, Lock, Cookie, Baby, Globe, Mail, RefreshCw } from "lucide-react";

export default function Privacy() {
  const lastUpdated = "January 23, 2026";

  return (
    <div className="min-h-screen bg-slate-950">
      <Header />
      
      <main className="pt-24 pb-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-600/20 border border-red-600/30 mb-6">
              <Shield className="h-8 w-8 text-red-500" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Privacy Policy
            </h1>
            <p className="text-lg text-slate-400">
              Diamond Sciences, LLC — Catching Barrels Swing Lab
            </p>
            <p className="text-sm text-slate-500 mt-2">
              Last Updated: {lastUpdated}
            </p>
          </div>

          <div className="space-y-6">
            {/* Introduction */}
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-600/20 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-3">Introduction</h2>
                    <p className="text-slate-300 leading-relaxed">
                      Diamond Sciences, LLC ("Company," "we," "us," or "our") respects your privacy and is 
                      committed to protecting your personal information. This Privacy Policy explains how we 
                      collect, use, disclose, and safeguard your information when you use our Catching Barrels 
                      Swing Lab services ("Services").
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Information We Collect */}
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-600/20 flex items-center justify-center">
                    <Database className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-3">1. Information We Collect</h2>
                    <p className="text-slate-300 leading-relaxed mb-4">
                      We collect information that you provide directly and information collected automatically:
                    </p>
                    
                    <h3 className="text-lg font-medium text-white mb-2">Personal Information</h3>
                    <ul className="space-y-2 mb-4">
                      {[
                        "Name, email address, and phone number",
                        "Date of birth and age",
                        "Parent/guardian contact information (for minors)",
                        "Billing and payment information"
                      ].map((item, index) => (
                        <li key={index} className="flex items-start gap-3 text-slate-300">
                          <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-red-500 mt-2" />
                          {item}
                        </li>
                      ))}
                    </ul>

                    <h3 className="text-lg font-medium text-white mb-2">Performance Data</h3>
                    <ul className="space-y-2 mb-4">
                      {[
                        "Swing videos and biomechanical analysis data",
                        "4B Scores (Brain, Body, Bat, Ball)",
                        "Training session records and progress metrics",
                        "Drill completion and performance history"
                      ].map((item, index) => (
                        <li key={index} className="flex items-start gap-3 text-slate-300">
                          <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-red-500 mt-2" />
                          {item}
                        </li>
                      ))}
                    </ul>

                    <h3 className="text-lg font-medium text-white mb-2">Automatically Collected Data</h3>
                    <ul className="space-y-2">
                      {[
                        "Device information and browser type",
                        "IP address and general location",
                        "Usage patterns and interaction data"
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

            {/* How We Use Your Information */}
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-600/20 flex items-center justify-center">
                    <Share2 className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-3">2. How We Use Your Information</h2>
                    <p className="text-slate-300 leading-relaxed mb-4">
                      We use your information for the following purposes:
                    </p>
                    <ul className="space-y-2">
                      {[
                        "Provide personalized swing analysis and coaching services",
                        "Generate 4B Scores and performance reports",
                        "Send training updates, drill recommendations, and coaching communications via SMS and email",
                        "Process payments and manage your account",
                        "Improve our Services and develop new features",
                        "Respond to your inquiries and provide customer support",
                        "Comply with legal obligations"
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

            {/* Data Sharing */}
            <Card className="bg-slate-900 border-red-600/50 border-2">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-600/20 flex items-center justify-center">
                    <Lock className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-3">3. Data Sharing & Disclosure</h2>
                    <p className="text-slate-300 leading-relaxed mb-4">
                      <strong className="text-white">We do not sell your personal information.</strong> We may share 
                      your information only in the following circumstances:
                    </p>
                    <ul className="space-y-2">
                      {[
                        "With service providers who assist in delivering our Services (e.g., payment processors, SMS providers)",
                        "With your consent or at your direction",
                        "To comply with legal requirements or respond to lawful requests",
                        "To protect our rights, privacy, safety, or property",
                        "In connection with a business transfer or merger"
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

            {/* Data Security */}
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-600/20 flex items-center justify-center">
                    <Lock className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-3">4. Data Security</h2>
                    <p className="text-slate-300 leading-relaxed">
                      We implement industry-standard security measures to protect your information, including 
                      encryption in transit and at rest, secure authentication, and regular security assessments. 
                      However, no method of electronic transmission or storage is 100% secure, and we cannot 
                      guarantee absolute security.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Data Retention */}
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-600/20 flex items-center justify-center">
                    <Database className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-3">5. Data Retention</h2>
                    <p className="text-slate-300 leading-relaxed">
                      We retain your personal information for as long as necessary to provide our Services 
                      and fulfill the purposes described in this policy. Performance data and training history 
                      are retained to enable long-term progress tracking. You may request deletion of your 
                      data at any time by contacting us.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cookies */}
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-600/20 flex items-center justify-center">
                    <Cookie className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-3">6. Cookies & Tracking</h2>
                    <p className="text-slate-300 leading-relaxed">
                      We use cookies and similar technologies to enhance your experience, analyze usage, and 
                      personalize content. You can manage cookie preferences through your browser settings. 
                      Disabling cookies may affect the functionality of certain features.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Children's Privacy */}
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-600/20 flex items-center justify-center">
                    <Baby className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-3">7. Children's Privacy</h2>
                    <p className="text-slate-300 leading-relaxed">
                      Our Services are used by athletes of various ages, including minors. For users under 18, 
                      we require parental or guardian consent before collecting personal information. Parents 
                      or guardians may review, update, or request deletion of their child's information by 
                      contacting us.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Your Rights */}
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-600/20 flex items-center justify-center">
                    <Globe className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-3">8. Your Rights</h2>
                    <p className="text-slate-300 leading-relaxed mb-4">
                      Depending on your location, you may have the following rights:
                    </p>
                    <ul className="space-y-2">
                      {[
                        "Access and receive a copy of your personal information",
                        "Correct inaccurate or incomplete information",
                        "Request deletion of your personal information",
                        "Opt out of marketing communications",
                        "Withdraw consent where processing is based on consent"
                      ].map((item, index) => (
                        <li key={index} className="flex items-start gap-3 text-slate-300">
                          <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-red-500 mt-2" />
                          {item}
                        </li>
                      ))}
                    </ul>
                    <p className="text-slate-300 leading-relaxed mt-4">
                      To exercise these rights, please contact us using the information below.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Policy Updates */}
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-600/20 flex items-center justify-center">
                    <RefreshCw className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-3">9. Changes to This Policy</h2>
                    <p className="text-slate-300 leading-relaxed">
                      We may update this Privacy Policy from time to time. Changes will be posted on this page 
                      with an updated "Last Updated" date. We encourage you to review this policy periodically. 
                      Continued use of our Services after changes constitutes acceptance of the updated policy.
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
                    <h2 className="text-xl font-semibold text-white mb-3">10. Contact Us</h2>
                    <p className="text-slate-300 leading-relaxed mb-4">
                      If you have questions about this Privacy Policy or wish to exercise your rights, please contact us:
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
                By using our Services, you acknowledge that you have read and understood this Privacy Policy.
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
