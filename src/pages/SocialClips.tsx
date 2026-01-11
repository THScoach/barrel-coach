import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Upload, Film, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { SocialClipEditor } from "@/components/social/SocialClipEditor";

export default function SocialClips() {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
    }
  }, []);

  const handleUrlSubmit = useCallback(() => {
    if (urlInput.trim()) {
      setVideoUrl(urlInput.trim());
    }
  }, [urlInput]);

  const handleReset = useCallback(() => {
    if (videoUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(videoUrl);
    }
    setVideoUrl(null);
    setUrlInput("");
  }, [videoUrl]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="sm" className="text-slate-400">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30">
                <Film className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-white">Social Clips</h1>
                <p className="text-xs text-slate-400">SAM3-powered visual clarity</p>
              </div>
            </div>
          </div>
          
          {videoUrl && (
            <Button variant="outline" size="sm" onClick={handleReset}>
              New Clip
            </Button>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {!videoUrl ? (
          /* Upload / URL Input Screen */
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 mb-4">
                <Sparkles className="h-8 w-8 text-amber-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Create Social-Ready Clips</h2>
              <p className="text-slate-400 max-w-md mx-auto">
                Upload a swing video and use AI-powered segmentation to create clean, 
                professional clips for TikTok, Instagram, and more.
              </p>
            </div>

            <div className="grid gap-6">
              {/* File Upload */}
              <Card className="bg-slate-800/50 border-slate-700 border-dashed p-8">
                <label className="flex flex-col items-center cursor-pointer">
                  <div className="p-4 rounded-full bg-slate-700/50 mb-4">
                    <Upload className="h-8 w-8 text-slate-400" />
                  </div>
                  <span className="text-sm font-medium text-white mb-1">Upload Video</span>
                  <span className="text-xs text-slate-500 mb-4">MP4, MOV, or WebM up to 100MB</span>
                  <Input
                    type="file"
                    accept="video/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button variant="outline" size="sm" className="pointer-events-none">
                    Choose File
                  </Button>
                </label>
              </Card>

              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-slate-700" />
                <span className="text-xs text-slate-500">OR</span>
                <div className="flex-1 h-px bg-slate-700" />
              </div>

              {/* URL Input */}
              <Card className="bg-slate-800/50 border-slate-700 p-6">
                <Label className="text-sm text-slate-300 mb-2 block">
                  Video URL
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="url"
                    placeholder="https://example.com/swing-video.mp4"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    className="flex-1 bg-slate-700/50 border-slate-600"
                  />
                  <Button onClick={handleUrlSubmit} disabled={!urlInput.trim()}>
                    Load
                  </Button>
                </div>
              </Card>
            </div>

            {/* Feature highlights */}
            <div className="grid grid-cols-3 gap-4 mt-12">
              {[
                { title: "Spotlight Hitter", desc: "Isolate the batter, dim the cage" },
                { title: "Track Bat Path", desc: "Highlight the barrel through the zone" },
                { title: "Export Ready", desc: "9:16 vertical for TikTok & Reels" },
              ].map((feature, i) => (
                <div key={i} className="text-center">
                  <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mx-auto mb-2">
                    <span className="text-xs font-bold text-amber-400">{i + 1}</span>
                  </div>
                  <h3 className="text-sm font-medium text-white">{feature.title}</h3>
                  <p className="text-xs text-slate-500">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Editor Screen */
          <SocialClipEditor videoUrl={videoUrl} />
        )}
      </main>
    </div>
  );
}
