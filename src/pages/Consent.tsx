import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Shield, Phone, Ban } from "lucide-react";

export default function Consent() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              SMS Messaging Consent
            </h1>
            <p className="text-lg text-muted-foreground">
              Catching Barrels Swing Lab - Mobile Messaging Terms
            </p>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  What Messages You'll Receive
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-muted-foreground">
                <p>
                  By providing your phone number and opting in, you consent to receive text messages from Catching Barrels Swing Lab including:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Session results and 4B Score updates</li>
                  <li>Personalized drill recommendations</li>
                  <li>Training tips from Coach Rick</li>
                  <li>Appointment reminders and scheduling updates</li>
                  <li>Important account notifications</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5 text-primary" />
                  Message Frequency
                </CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground">
                <p>
                  Message frequency varies based on your activity. You may receive up to 10 messages per week during active training periods. Standard message and data rates may apply.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Ban className="h-5 w-5 text-primary" />
                  How to Opt Out
                </CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground">
                <p>
                  You can opt out of SMS messages at any time by replying <strong>STOP</strong> to any message you receive. You will receive a confirmation message and will no longer receive texts from us.
                </p>
                <p className="mt-3">
                  To opt back in, reply <strong>START</strong> or contact us directly.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  Privacy & Data Protection
                </CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground space-y-3">
                <p>
                  Your phone number and personal information are protected. We do not sell, rent, or share your mobile number with third parties for marketing purposes.
                </p>
                <p>
                  For questions about our SMS program, contact us at{" "}
                  <a href="mailto:lab@catchingbarrels.com" className="text-primary hover:underline">
                    lab@catchingbarrels.com
                  </a>
                </p>
              </CardContent>
            </Card>

            <div className="text-center text-sm text-muted-foreground pt-6 border-t border-border">
              <p>
                By signing up for our services and providing your phone number, you agree to these SMS terms.
              </p>
              <p className="mt-2">
                Catching Barrels LLC • St. Louis, MO
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
