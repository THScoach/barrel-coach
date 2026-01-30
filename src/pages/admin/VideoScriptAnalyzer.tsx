import { useState } from 'react';
import { AdminHeader } from '@/components/AdminHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  FileText, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  Target,
  Zap,
  MessageSquare,
  TrendingUp,
  Copy,
  RefreshCw
} from 'lucide-react';

interface AnalysisResult {
  hookScore: number;
  ctaScore: number;
  brandVoiceScore: number;
  overallScore: number;
  teachingMoments: string[];
  quotablePhrases: string[];
  fourBConcepts: string[];
  suggestions: string[];
  platformFormats: {
    tiktok: string;
    instagram: string;
    twitter: string;
    youtube: string;
  };
}

export default function VideoScriptAnalyzer() {
  const [transcript, setTranscript] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'ready'>('idle');
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const handleAnalyze = async () => {
    if (!transcript.trim()) {
      toast.error('Please paste a video transcript first');
      return;
    }

    setIsAnalyzing(true);
    setStatus('analyzing');
    setProgress(0);
    setResult(null);

    // Simulate progress updates
    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 10, 90));
    }, 500);

    try {
      const { data, error } = await supabase.functions.invoke('analyze-video-script', {
        body: { transcript }
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (error) throw error;

      setResult(data);
      setStatus('ready');
      toast.success('Analysis complete!');
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Failed to analyze transcript');
      setStatus('idle');
    } finally {
      clearInterval(progressInterval);
      setIsAnalyzing(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-500/10 border-green-500/20';
    if (score >= 60) return 'bg-yellow-500/10 border-yellow-500/20';
    return 'bg-red-500/10 border-red-500/20';
  };

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      
      <main className="container py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <FileText className="h-8 w-8 text-accent" />
            Video Script Analyzer
          </h1>
          <p className="text-muted-foreground mt-2">
            Analyze video transcripts for teaching moments, brand voice, and platform-ready content
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Input Section */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Transcript Input
                </CardTitle>
                <CardDescription>
                  Paste a video transcript to analyze for coaching insights
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Paste your video transcript here...

Example:
'Alright, let's talk about Transfer Ratio. This is THE metric that separates elite hitters from average ones. What most coaches get wrong is they focus on bat speed alone. But here's the thing - if you can't transfer that speed efficiently to the ball, you're leaving power on the table...'"
                  className="min-h-[300px] font-mono text-sm"
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                />
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {transcript.split(/\s+/).filter(Boolean).length} words
                  </span>
                  
                  <Button 
                    onClick={handleAnalyze} 
                    disabled={isAnalyzing || !transcript.trim()}
                    className="gap-2"
                  >
                    {isAnalyzing ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Analyze Script
                      </>
                    )}
                  </Button>
                </div>

                {/* Status Indicator */}
                {status !== 'idle' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {status === 'analyzing' && (
                        <>
                          <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
                          <span className="text-sm font-medium text-yellow-500">Analyzing...</span>
                        </>
                      )}
                      {status === 'ready' && (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span className="text-sm font-medium text-green-500">Ready</span>
                        </>
                      )}
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Results Section */}
          <div className="space-y-6">
            {result ? (
              <>
                {/* Scores Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      Content Scores
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className={`p-4 rounded-lg border ${getScoreBg(result.hookScore)}`}>
                        <div className="text-sm text-muted-foreground">Hook Strength</div>
                        <div className={`text-2xl font-bold ${getScoreColor(result.hookScore)}`}>
                          {result.hookScore}/100
                        </div>
                      </div>
                      <div className={`p-4 rounded-lg border ${getScoreBg(result.ctaScore)}`}>
                        <div className="text-sm text-muted-foreground">CTA Effectiveness</div>
                        <div className={`text-2xl font-bold ${getScoreColor(result.ctaScore)}`}>
                          {result.ctaScore}/100
                        </div>
                      </div>
                      <div className={`p-4 rounded-lg border ${getScoreBg(result.brandVoiceScore)}`}>
                        <div className="text-sm text-muted-foreground">Brand Voice</div>
                        <div className={`text-2xl font-bold ${getScoreColor(result.brandVoiceScore)}`}>
                          {result.brandVoiceScore}/100
                        </div>
                      </div>
                      <div className={`p-4 rounded-lg border ${getScoreBg(result.overallScore)}`}>
                        <div className="text-sm text-muted-foreground">Overall</div>
                        <div className={`text-2xl font-bold ${getScoreColor(result.overallScore)}`}>
                          {result.overallScore}/100
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Teaching Moments */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-yellow-500" />
                      Teaching Moments
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {result.teachingMoments.map((moment, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                          {moment}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                {/* Quotable Phrases */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5 text-accent" />
                      Quotable Phrases
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {result.quotablePhrases.map((phrase, i) => (
                        <div 
                          key={i} 
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg group"
                        >
                          <span className="text-sm italic">"{phrase}"</span>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => copyToClipboard(phrase, 'Quote')}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* 4B Concepts */}
                <Card>
                  <CardHeader>
                    <CardTitle>4B Concepts Detected</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {result.fourBConcepts.map((concept, i) => (
                        <Badge key={i} variant="secondary">{concept}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Platform Formats */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Platform-Ready Formats
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {Object.entries(result.platformFormats).map(([platform, content]) => (
                      <div key={platform} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="capitalize">{platform}</Badge>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => copyToClipboard(content, `${platform} format`)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                          {content}
                        </p>
                        <Separator />
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Suggestions */}
                {result.suggestions.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-yellow-500" />
                        Improvement Suggestions
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {result.suggestions.map((suggestion, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="text-yellow-500">•</span>
                            {suggestion}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card className="h-full flex items-center justify-center min-h-[400px]">
                <CardContent className="text-center py-12">
                  <FileText className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                  <h3 className="text-lg font-semibold text-muted-foreground">No Analysis Yet</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    Paste a video transcript and click "Analyze Script" to get started
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
