import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Share2,
  Copy,
  Check,
  Loader2,
  Sparkles,
  AlertTriangle,
  Brain,
  Activity,
  Zap,
  Target,
  RefreshCw,
  Download,
  Twitter,
  Instagram,
} from "lucide-react";
import { toast } from "sonner";

interface SessionData {
  composite_score?: number | null;
  brain_score?: number | null;
  body_score?: number | null;
  bat_score?: number | null;
  motor_profile?: string | null;
  leak_detected?: string | null;
  priority_drill?: string | null;
  level?: string | null;
}

interface SocialPostGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionData: SessionData;
  playerName?: string;
}

interface GeneratedPost {
  headline: string;
  theCase: string;
  theLeak: string;
  theFix: string;
  theLabView: string;
  hashtags: string;
}

interface GenerateResponse {
  success: boolean;
  post: GeneratedPost;
  fullPost: string;
  archetype: string;
  scores: {
    brain: number;
    body: number;
    bat: number;
    composite: number;
  };
}

export function SocialPostGenerator({
  open,
  onOpenChange,
  sessionData,
  playerName,
}: SocialPostGeneratorProps) {
  const [generatedPost, setGeneratedPost] = useState<GeneratedPost | null>(null);
  const [fullPostText, setFullPostText] = useState("");
  const [archetype, setArchetype] = useState("");
  const [scores, setScores] = useState({ brain: 0, body: 0, bat: 0, composite: 0 });
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("generate-social-post", {
        body: {
          sessionData: {
            composite_score: sessionData.composite_score,
            brain_score: sessionData.brain_score,
            body_score: sessionData.body_score,
            bat_score: sessionData.bat_score,
            motor_profile: sessionData.motor_profile,
            leak_detected: sessionData.leak_detected,
            priority_drill: sessionData.priority_drill,
            level: sessionData.level,
          },
        },
      });

      if (error) throw error;
      return data as GenerateResponse;
    },
    onSuccess: (data) => {
      setGeneratedPost(data.post);
      setFullPostText(data.fullPost);
      setArchetype(data.archetype);
      setScores(data.scores);
      toast.success("Anonymous post generated!");
    },
    onError: (error) => {
      toast.error(`Failed to generate: ${error.message}`);
    },
  });

  const handleCopy = async () => {
    try {
      // Build plain text version for copying
      const plainText = `${generatedPost?.headline}\n\n🔬 The Case: ${generatedPost?.theCase}\n\n⚠️ The Leak: ${generatedPost?.theLeak}\n\n🔧 The Fix: ${generatedPost?.theFix}\n\n📊 The Lab View: ${generatedPost?.theLabView}\n\n${generatedPost?.hashtags}`;
      await navigator.clipboard.writeText(plainText);
      setCopied(true);
      toast.success("Copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleRegenerate = () => {
    generateMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-5xl h-[90vh] p-0 overflow-hidden"
        style={{ backgroundColor: "#0A0A0B", border: "1px solid rgba(220, 38, 38, 0.3)" }}
      >
        <div className="flex h-full">
          {/* Left Side - Controls & Editor */}
          <div className="w-1/2 p-6 border-r border-slate-700/50 overflow-y-auto">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
                <Sparkles className="h-5 w-5" style={{ color: "#DC2626" }} />
                Anonymous Lab Post Generator
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                Generate shareable content without exposing player identity
              </DialogDescription>
            </DialogHeader>

            {/* Data Strip Notice */}
            <div className="mb-6 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                <Check className="h-4 w-4" />
                PII Stripped
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {playerName ? `"${playerName}" → "REDACTED"` : "No player name attached"}
              </p>
            </div>

            {/* Session Data Preview */}
            <div className="mb-6 p-4 rounded-lg bg-slate-800/50 border border-slate-700">
              <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Session Data
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-slate-600 text-slate-300">
                    Motor Profile
                  </Badge>
                  <span className="text-white capitalize">
                    {sessionData.motor_profile || "Unknown"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-amber-500/50 text-amber-400">
                    Leak
                  </Badge>
                  <span className="text-white">
                    {sessionData.leak_detected || "None detected"}
                  </span>
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <Badge variant="outline" className="border-[#DC2626]/50 text-[#DC2626]">
                    Drill
                  </Badge>
                  <span className="text-white text-xs">
                    {sessionData.priority_drill || "Standard fundamentals"}
                  </span>
                </div>
              </div>
            </div>

            {/* Generate Button */}
            {!generatedPost && (
              <Button
                className="w-full py-6 text-lg font-bold bg-[#DC2626] hover:bg-[#DC2626]/90"
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Generating Anonymous Post...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5 mr-2" />
                    Generate Anonymous Post
                  </>
                )}
              </Button>
            )}

            {/* Generated Content Editor */}
            {generatedPost && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                    Generated Content
                  </h4>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-[#DC2626] hover:bg-[#DC2626]/20"
                    onClick={handleRegenerate}
                    disabled={generateMutation.isPending}
                  >
                    <RefreshCw className={`h-4 w-4 mr-1 ${generateMutation.isPending ? "animate-spin" : ""}`} />
                    Regenerate
                  </Button>
                </div>

                {isEditing ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-slate-400">Headline</label>
                      <Textarea
                        value={generatedPost.headline}
                        onChange={(e) =>
                          setGeneratedPost({ ...generatedPost, headline: e.target.value })
                        }
                        className="mt-1 bg-slate-800 border-slate-600 text-white text-sm"
                        rows={1}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">The Case</label>
                      <Textarea
                        value={generatedPost.theCase}
                        onChange={(e) =>
                          setGeneratedPost({ ...generatedPost, theCase: e.target.value })
                        }
                        className="mt-1 bg-slate-800 border-slate-600 text-white text-sm"
                        rows={2}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">The Leak</label>
                      <Textarea
                        value={generatedPost.theLeak}
                        onChange={(e) =>
                          setGeneratedPost({ ...generatedPost, theLeak: e.target.value })
                        }
                        className="mt-1 bg-slate-800 border-slate-600 text-white text-sm"
                        rows={2}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">The Fix</label>
                      <Textarea
                        value={generatedPost.theFix}
                        onChange={(e) =>
                          setGeneratedPost({ ...generatedPost, theFix: e.target.value })
                        }
                        className="mt-1 bg-slate-800 border-slate-600 text-white text-sm"
                        rows={2}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">The Lab View</label>
                      <Textarea
                        value={generatedPost.theLabView}
                        onChange={(e) =>
                          setGeneratedPost({ ...generatedPost, theLabView: e.target.value })
                        }
                        className="mt-1 bg-slate-800 border-slate-600 text-white text-sm"
                        rows={2}
                      />
                    </div>
                    <Button
                      size="sm"
                      className="w-full bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => setIsEditing(false)}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Done Editing
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                      <p className="text-lg font-bold text-white mb-3">{generatedPost.headline}</p>
                      <div className="space-y-2 text-sm text-slate-300">
                        <p>
                          <span className="text-emerald-400">🔬 The Case:</span> {generatedPost.theCase}
                        </p>
                        <p>
                          <span className="text-amber-400">⚠️ The Leak:</span> {generatedPost.theLeak}
                        </p>
                        <p>
                          <span className="text-blue-400">🔧 The Fix:</span> {generatedPost.theFix}
                        </p>
                        <p>
                          <span className="text-purple-400">📊 The Lab View:</span>{" "}
                          {generatedPost.theLabView}
                        </p>
                        <p className="text-[#DC2626] pt-2">{generatedPost.hashtags}</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 border-slate-600 text-white hover:bg-slate-800"
                        onClick={() => setIsEditing(true)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 bg-[#DC2626] hover:bg-[#DC2626]/90"
                        onClick={handleCopy}
                      >
                        {copied ? (
                          <>
                            <Check className="h-4 w-4 mr-1" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4 mr-1" />
                            Copy Text
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                <Separator className="bg-slate-700" />

                {/* Quick Share Buttons */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 border-slate-600 text-white hover:bg-slate-800"
                    onClick={() => {
                      const text = encodeURIComponent(
                        `${generatedPost.headline}\n\n${generatedPost.theCase}\n\n${generatedPost.hashtags}`
                      );
                      window.open(`https://twitter.com/intent/tweet?text=${text}`, "_blank");
                    }}
                  >
                    <Twitter className="h-4 w-4 mr-1" />
                    Twitter
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 border-slate-600 text-white hover:bg-slate-800"
                    onClick={handleCopy}
                  >
                    <Instagram className="h-4 w-4 mr-1" />
                    Copy for IG
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Right Side - Shareable Preview Card */}
          <div className="w-1/2 bg-slate-900 flex items-center justify-center p-8">
            <div className="w-full max-w-md" ref={cardRef}>
              <ShareablePreviewCard
                post={generatedPost}
                archetype={archetype}
                scores={scores}
                isLoading={generateMutation.isPending}
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Shareable Preview Card Component
function ShareablePreviewCard({
  post,
  archetype,
  scores,
  isLoading,
}: {
  post: GeneratedPost | null;
  archetype: string;
  scores: { brain: number; body: number; bat: number; composite: number };
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <Card
        className="overflow-hidden"
        style={{
          backgroundColor: "#0A0A0B",
          border: "2px solid rgba(220, 38, 38, 0.4)",
        }}
      >
        <CardContent className="p-8 flex flex-col items-center justify-center min-h-[400px]">
          <Loader2 className="h-12 w-12 animate-spin mb-4" style={{ color: "#DC2626" }} />
          <p className="text-slate-400">Generating anonymous post...</p>
        </CardContent>
      </Card>
    );
  }

  if (!post) {
    return (
      <Card
        className="overflow-hidden"
        style={{
          backgroundColor: "#0A0A0B",
          border: "2px solid rgba(220, 38, 38, 0.2)",
        }}
      >
        <CardContent className="p-8 flex flex-col items-center justify-center min-h-[400px] text-center">
          <Share2 className="h-16 w-16 mb-4 opacity-30" style={{ color: "#DC2626" }} />
          <h3 className="text-lg font-semibold text-white mb-2">Shareable Preview</h3>
          <p className="text-sm text-slate-400 max-w-xs">
            Click "Generate Anonymous Post" to create a shareable card with redacted player info
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className="overflow-hidden shadow-2xl"
      style={{
        backgroundColor: "#0A0A0B",
        border: "2px solid rgba(220, 38, 38, 0.5)",
        boxShadow: "0 0 40px rgba(220, 38, 38, 0.2)",
      }}
    >
      {/* Header with REDACTED stamp */}
      <div
        className="p-4 relative"
        style={{
          background: "linear-gradient(135deg, #DC2626 0%, #991B1B 100%)",
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-white/70 uppercase tracking-wider">4B Lab Analysis</p>
            <h3 className="text-lg font-bold text-white">{archetype || "Lab Subject"}</h3>
          </div>
          <div
            className="px-3 py-1 rounded border-2 border-white/50 transform rotate-[-8deg]"
            style={{ backgroundColor: "rgba(0,0,0,0.3)" }}
          >
            <span className="text-xs font-black text-white tracking-widest">REDACTED</span>
          </div>
        </div>
      </div>

      {/* 4B Scorecard */}
      <div className="p-4 border-b border-slate-800">
        <div className="grid grid-cols-4 gap-2 text-center">
          <ScoreBox label="Brain" value={scores.brain} icon={Brain} />
          <ScoreBox label="Body" value={scores.body} icon={Activity} />
          <ScoreBox label="Bat" value={scores.bat} icon={Zap} />
          <ScoreBox label="Comp" value={scores.composite} icon={Target} />
        </div>
      </div>

      {/* Content */}
      <CardContent className="p-4 space-y-3">
        <h4 className="text-lg font-bold text-white">{post.headline}</h4>

        <div className="space-y-2 text-sm">
          <div className="p-2 rounded bg-slate-800/50">
            <span className="text-emerald-400 text-xs font-semibold">THE CASE</span>
            <p className="text-slate-300 mt-1">{post.theCase}</p>
          </div>

          <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20">
            <span className="text-amber-400 text-xs font-semibold flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              THE LEAK
            </span>
            <p className="text-slate-300 mt-1">{post.theLeak}</p>
          </div>

          <div className="p-2 rounded bg-blue-500/10 border border-blue-500/20">
            <span className="text-blue-400 text-xs font-semibold">THE FIX</span>
            <p className="text-slate-300 mt-1">{post.theFix}</p>
          </div>
        </div>

        <p className="text-xs text-[#DC2626] pt-2">{post.hashtags}</p>
      </CardContent>

      {/* Footer */}
      <div
        className="px-4 py-2 text-center text-xs text-slate-500 border-t border-slate-800"
        style={{ backgroundColor: "#111113" }}
      >
        Generated by The 4B Lab • barrel-coach.lovable.app
      </div>
    </Card>
  );
}

function ScoreBox({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Brain;
}) {
  return (
    <div className="p-2 rounded bg-slate-800/50">
      <Icon className="h-4 w-4 mx-auto mb-1" style={{ color: "#DC2626" }} />
      <p className="text-[10px] text-slate-400 uppercase">{label}</p>
      <p className="text-lg font-bold text-white">{value || "—"}</p>
    </div>
  );
}
