import { useParams, Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ExternalLink } from "lucide-react";

export default function SessionView() {
  const { sessionId } = useParams<{ sessionId: string }>();

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Header />
      <main className="flex-1 pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full">
        {/* Back link */}
        <Link to="/athletes" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Athletes
        </Link>

        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl md:text-3xl font-black text-white">Session Details</h1>
          {sessionId && (
            <Button asChild variant="outline" className="border-slate-700 text-slate-300 hover:text-white">
              <a
                href={`https://dashboard.rebootmotion.com/sessions/${sessionId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View in Reboot
              </a>
            </Button>
          )}
        </div>

        {/* 4B Framework cards - placeholder */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {["Brain", "Body", "Bat", "Ball"].map((category) => (
            <Card key={category} className="bg-slate-900/80 border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-slate-400 uppercase tracking-wider">
                  {category}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-black text-white">—</p>
                <p className="text-xs text-slate-500 mt-1">Awaiting data</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Session info */}
        <Card className="bg-slate-900/80 border-slate-800 mb-6">
          <CardHeader>
            <CardTitle className="text-white text-lg">Session Info</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-slate-500">Session ID</p>
                <p className="text-white font-mono text-xs truncate">{sessionId || "—"}</p>
              </div>
              <div>
                <p className="text-slate-500">Status</p>
                <p className="text-yellow-400 font-medium">Processing</p>
              </div>
              <div>
                <p className="text-slate-500">Date</p>
                <p className="text-white">{new Date().toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-slate-500">Videos</p>
                <p className="text-white">—</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Coaching notes placeholder */}
        <Card className="bg-slate-900/80 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white text-lg">Coaching Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-400">
              Session data will populate here once Reboot Motion processing is complete.
              This typically takes 5–15 minutes after upload.
            </p>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
