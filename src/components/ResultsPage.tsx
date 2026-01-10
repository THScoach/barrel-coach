import { Download, Mail, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScoreCircle } from '@/components/ScoreCircle';
import { CoachRickChat } from '@/components/CoachRickChat';
import { VideoRecommendations } from '@/components/VideoRecommendations';
import { AnalysisResults, FourBScores } from '@/types/analysis';
import { cn } from '@/lib/utils';

interface ResultsPageProps {
  results: AnalysisResults;
  userAccessLevel?: 'free' | 'paid' | 'inner_circle';
}

export function ResultsPage({ results, userAccessLevel = 'paid' }: ResultsPageProps) {
  const isCompleteReview = results.productType === 'complete_review';
  
  // Determine access level based on product type
  const accessLevel: 'free' | 'paid' | 'inner_circle' = userAccessLevel;
  
  return (
    <div className="animate-fade-in max-w-3xl mx-auto pb-16">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">{results.playerInfo.name.toUpperCase()}</h1>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="w-4 h-4" />
          Download PDF
        </Button>
      </div>

      {/* Main Score */}
      <div className="text-center mb-12">
        <ScoreCircle score={results.compositeScore} grade={results.grade} />
        <p className="mt-6 text-lg text-muted-foreground max-w-md mx-auto">
          "You're doing pretty good. But you're losing power because of one problem we found."
        </p>
      </div>

      {/* Best vs Worst (Complete Review only) */}
      {isCompleteReview && results.bestSwing && results.worstSwing && (
        <Card className="p-6 mb-8">
          <h2 className="text-lg font-bold mb-6">YOUR BEST VS YOUR WORST</h2>
          <div className="grid grid-cols-2 gap-6">
            <div className="text-center">
              <div className="inline-flex flex-col items-center">
                <ScoreCircle score={results.bestSwing.score} size="md" variant="accent" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Swing #{results.bestSwing.index + 1}
                </p>
              </div>
            </div>
            <div className="text-center">
              <div className="inline-flex flex-col items-center">
                <ScoreCircle score={results.worstSwing.score} size="md" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Swing #{results.worstSwing.index + 1}
                </p>
              </div>
            </div>
          </div>
          <p className="mt-6 text-center text-muted-foreground">
            "Your best swing is really good ({results.bestSwing.score}). 
            Your goal is to do that every time."
          </p>
        </Card>
      )}

      {/* Percentile (Complete Review only) */}
      {isCompleteReview && results.percentile && (
        <Card className="p-6 mb-8">
          <h2 className="text-lg font-bold mb-4">WHERE YOU RANK</h2>
          <div className="relative py-4">
            <div className="h-2 bg-muted rounded-full">
              <div 
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-accent border-2 border-white shadow-lg"
                style={{ left: `${results.percentile}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>0%</span>
              <span>100%</span>
            </div>
            <div 
              className="absolute -top-6 text-xs font-medium"
              style={{ left: `${results.percentile}%`, transform: 'translateX(-50%)' }}
            >
              YOU
            </div>
          </div>
          <p className="mt-4 text-center text-muted-foreground">
            "You're better than {Math.round(results.percentile / 10)} out of 10 kids your age."
          </p>
        </Card>
      )}

      {/* Main Problem */}
      {results.mainProblem && (
        <Card className="p-6 mb-8 border-destructive/30">
          <h2 className="text-lg font-bold mb-4">YOUR PROBLEM</h2>
          
          <ScoreBar 
            label={results.mainProblem.category?.toUpperCase() || 'ISSUE'}
            score={results.scores?.[results.mainProblem.category] || 0}
            description="How you swing the bat"
            isWeakest
          />
          
          <div className="mt-6">
            <h3 className="font-bold text-lg mb-2">
              {typeof results.mainProblem.name === 'string' 
                ? results.mainProblem.name 
                : (results.mainProblem.name as any)?.name || 'Problem Identified'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {typeof results.mainProblem.description === 'string' 
                ? results.mainProblem.description 
                : String(results.mainProblem.description || '')}
            </p>
            
            {results.mainProblem.consequences && results.mainProblem.consequences.length > 0 && (
              <div className="space-y-2">
                <p className="font-medium text-sm">What this costs you:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {results.mainProblem.consequences.map((consequence, i) => (
                    <li key={i}>• {typeof consequence === 'string' ? consequence : String(consequence)}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* How to Fix It */}
      {results.drill && (
        <Card className="p-6 mb-8 border-success/30 bg-success/5">
          <h2 className="text-lg font-bold mb-4">HOW TO FIX IT</h2>
          
          <div className="p-4 rounded-lg bg-background border border-border">
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-bold">
                {typeof results.drill.name === 'string' 
                  ? results.drill.name 
                  : (results.drill.name as any)?.name || 'Recommended Drill'}
              </h3>
              {results.drill.sets && results.drill.reps && (
                <span className="text-sm text-muted-foreground">
                  {results.drill.sets} sets × {results.drill.reps} reps
                </span>
              )}
            </div>
            {results.drill.instructions && (
              <p className="text-sm text-muted-foreground mb-3">
                {typeof results.drill.instructions === 'string' 
                  ? results.drill.instructions 
                  : String(results.drill.instructions)}
              </p>
            )}
            {results.drill.whyItWorks && (
              <p className="text-sm">
                <span className="font-medium">Why this works:</span>{' '}
                <span className="text-muted-foreground">
                  {typeof results.drill.whyItWorks === 'string' 
                    ? results.drill.whyItWorks 
                    : String(results.drill.whyItWorks)}
                </span>
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Personalized Video Recommendations */}
      <VideoRecommendations 
        weakestCategory={results.mainProblem.category}
        problemsAddressed={results.mainProblem.name ? [results.mainProblem.name.toLowerCase().replace(/\s+/g, '_')] : []}
        userAccessLevel={accessLevel}
        maxVideos={5}
      />

      {/* Coach Rick AI Chat */}
      <CoachRickChat 
        scores={results.scores} 
        weakestCategory={results.mainProblem.category} 
      />
      {isCompleteReview && results.thirtyDayPlan && (
        <Card className="p-6 mb-8">
          <h2 className="text-lg font-bold mb-4">YOUR 30-DAY PLAN</h2>
          <div className="space-y-3 text-sm">
            <p><span className="font-medium">Week 1-2:</span> {results.thirtyDayPlan.week1_2}</p>
            <p><span className="font-medium">Week 3-4:</span> {results.thirtyDayPlan.week3_4}</p>
            <p><span className="font-medium">Week 5-6:</span> {results.thirtyDayPlan.week5_6}</p>
          </div>
          <div className="mt-4 pt-4 border-t border-border text-sm text-muted-foreground">
            {results.thirtyDayPlan.schedule}
          </div>
        </Card>
      )}

      {/* Upsell - Complete Review (Single Swing only) */}
      {!isCompleteReview && (
        <Card className="p-6 mb-8 bg-accent/5 border-accent/30">
          <h2 className="text-lg font-bold mb-4">WANT THE FULL PICTURE?</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xl">Complete Swing Review™</span>
              <span className="font-bold text-xl">$97</span>
            </div>
            <ul className="space-y-2 text-sm">
              <li>• See your best swing vs worst swing</li>
              <li>• See how you compare to other {results.playerInfo.age}-year-olds</li>
              <li>• Get a 30-day improvement plan</li>
            </ul>
            <Button variant="accent" size="lg" className="w-full gap-2">
              GET THE FULL PICTURE
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* Upsell - Inner Circle (Complete Review only) */}
      {isCompleteReview && (
        <Card className="p-6 mb-8 bg-primary text-primary-foreground">
          <h2 className="text-lg font-bold mb-2">WANT PERSONAL COACHING?</h2>
          <p className="text-sm opacity-80 mb-4">
            Rick Strickland is the MLB Hitting Coach for the Baltimore Orioles. 
            He's trained Pete Crow-Armstrong, Andrew Benintendi, and Devin Williams.
          </p>
          
          <div className="p-4 rounded-lg bg-white/10 backdrop-blur">
            <div className="flex items-center justify-between mb-3">
              <span className="font-bold">Rick's Inner Circle</span>
              <span className="font-bold">$297/month</span>
            </div>
            <ul className="space-y-1 text-sm opacity-90 mb-4">
              <li>• 2 personal video reviews from Rick</li>
              <li>• Weekly group coaching calls</li>
              <li>• Direct access via chat</li>
            </ul>
            <p className="text-xs opacity-70 mb-3">Only 12 spots left</p>
            <Button 
              variant="hero" 
              size="lg" 
              className="w-full"
            >
              JOIN THE INNER CIRCLE
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </Card>
      )}

      {/* Email Confirmation */}
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Mail className="w-4 h-4" />
        <span>Your PDF report has been emailed to you</span>
      </div>
    </div>
  );
}

interface ScoreBarProps {
  label: string;
  score: number;
  description: string;
  isWeakest?: boolean;
}

function ScoreBar({ label, score, description, isWeakest }: ScoreBarProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-bold">{label}: {Math.round(score)}</span>
      </div>
      <div className="h-3 bg-muted rounded-full overflow-hidden">
        <div 
          className={cn(
            'h-full rounded-full transition-all',
            isWeakest ? 'bg-destructive' : 'bg-accent'
          )}
          style={{ width: `${score}%` }}
        />
      </div>
      <p className="text-sm text-muted-foreground">"{description}"</p>
    </div>
  );
}
