/**
 * Scout Brief Generator - Creates 8th-grade friendly summary of swing leaks
 * Now includes Diamond Kinetics weapon metrics (WIP Index, Plane Integrity, etc.)
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Sparkles, Copy, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { WeaponMetrics, getWeaponGrade } from "@/lib/weapon-metrics";

interface ScoutBriefGeneratorProps {
  playerName: string;
  brainScore: number | null;
  bodyScore: number | null;
  batScore: number | null;
  ballScore: number | null;
  compositeScore: number | null;
  weakestLink: string | null;
  leaks?: string[];
  projectedEV?: number | null;
  avgVBA?: number | null;
  weaponMetrics?: WeaponMetrics | null;
}

// 8th-grade friendly leak translations
const LEAK_TRANSLATIONS: Record<string, string> = {
  timing_leak: "Your swing timing changes too much from swing to swing",
  power_leak: "You're losing power before the bat gets to the ball",
  early_extension: "Your arms are reaching out too early",
  late_legs: "Your legs aren't starting the swing - your arms are",
  torso_bypass: "Your core isn't rotating enough - arms doing all the work",
  cast: "Your hands are getting away from your body too soon",
  bar_arm: "Your back arm is straightening too early",
  early_shoulder_rotation: "Your shoulders are opening before your hips",
};

// Generate a simple brief locally (fallback)
function generateLocalBrief(props: ScoutBriefGeneratorProps): string {
  const { playerName, brainScore, bodyScore, batScore, ballScore, compositeScore, weakestLink, leaks, projectedEV, avgVBA, weaponMetrics } = props;
  
  const firstName = playerName.split(' ')[0] || 'This player';
  const grade = compositeScore !== null 
    ? (compositeScore >= 60 ? 'solid' : compositeScore >= 50 ? 'average' : 'developing')
    : 'ungraded';

  let brief = `## ${playerName} - Scout Brief\n\n`;
  brief += `**Overall Grade:** ${compositeScore ?? '—'} (${grade})\n\n`;
  
  // Strengths
  const scores = [
    { name: 'Brain', score: brainScore },
    { name: 'Body', score: bodyScore },
    { name: 'Bat', score: batScore },
    { name: 'Ball', score: ballScore },
  ].filter(s => s.score !== null);
  
  const strongest = scores.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
  if (strongest && strongest.score && strongest.score >= 50) {
    brief += `**What's Working:** ${firstName}'s ${strongest.name.toLowerCase()} mechanics are ${strongest.score >= 60 ? 'a real strength' : 'solid'}. `;
    if (strongest.name === 'Brain') brief += "They repeat their swing well.";
    if (strongest.name === 'Body') brief += "They use their legs and ground well.";
    if (strongest.name === 'Bat') brief += "Energy transfers efficiently to the barrel.";
    if (strongest.name === 'Ball') brief += "They square the ball up consistently.";
    brief += '\n\n';
  }
  
  // Weapon Metrics Section
  if (weaponMetrics && Object.values(weaponMetrics).some(v => v !== null)) {
    brief += `**Weapon Report (DK Sensor):**\n`;
    
    if (weaponMetrics.wipIndex !== null) {
      const wipGrade = getWeaponGrade(weaponMetrics.wipIndex);
      const wipInsight = weaponMetrics.wipIndex >= 55 
        ? "Great bat whip - energy transfers well from hands to barrel"
        : "Working on getting more 'whip' in the swing - hands leading, then the barrel snaps through";
      brief += `- **WIP Index:** ${weaponMetrics.wipIndex} (${wipGrade}) - ${wipInsight}\n`;
    }
    
    if (weaponMetrics.planeIntegrity !== null) {
      const planeGrade = getWeaponGrade(weaponMetrics.planeIntegrity);
      const planeInsight = weaponMetrics.planeIntegrity >= 55
        ? "Consistent swing plane - bat path repeats well"
        : "Swing plane varies - focus on staying on plane with tee work";
      brief += `- **Plane Integrity:** ${weaponMetrics.planeIntegrity} (${planeGrade}) - ${planeInsight}\n`;
    }
    
    if (weaponMetrics.squareUpConsistency !== null) {
      const sqGrade = getWeaponGrade(weaponMetrics.squareUpConsistency);
      const sqInsight = weaponMetrics.squareUpConsistency >= 55
        ? "Hitting the barrel sweet spot consistently"
        : "Contact point moves around - need more barrel awareness drills";
      brief += `- **Square-Up:** ${weaponMetrics.squareUpConsistency} (${sqGrade}) - ${sqInsight}\n`;
    }
    
    if (weaponMetrics.impactMomentum !== null) {
      const impactGrade = getWeaponGrade(weaponMetrics.impactMomentum);
      const impactInsight = weaponMetrics.impactMomentum >= 55
        ? "Good power at contact - ball jumps off the bat"
        : "Building more power delivery at contact - sequencing drills will help";
      brief += `- **Impact Momentum:** ${weaponMetrics.impactMomentum} (${impactGrade}) - ${impactInsight}\n`;
    }
    
    brief += '\n';
  }
  
  // What to fix
  if (weakestLink) {
    brief += `**What to Fix:** Focus on ${weakestLink.toUpperCase()}. `;
    if (weakestLink.toLowerCase() === 'brain') brief += "The swing timing changes too much - need more reps for consistency.";
    if (weakestLink.toLowerCase() === 'body') brief += "Not using the ground enough - power starts from the legs, not the arms.";
    if (weakestLink.toLowerCase() === 'bat') brief += "Energy is leaking out before it reaches the barrel.";
    if (weakestLink.toLowerCase() === 'ball') brief += "Contact quality needs work - not squaring up enough.";
    brief += '\n\n';
  }
  
  // Leaks in plain English
  if (leaks && leaks.length > 0) {
    brief += `**In Plain English:**\n`;
    leaks.forEach(leak => {
      const translation = LEAK_TRANSLATIONS[leak.toLowerCase()] || leak;
      brief += `- ${translation}\n`;
    });
    brief += '\n';
  }
  
  // Ghost stats
  if (projectedEV) {
    brief += `**Projected Exit Velo:** ${projectedEV} mph\n`;
  }
  if (avgVBA !== null) {
    const zone = avgVBA > 5 ? 'up in the zone' : avgVBA < -5 ? 'low in the zone' : 'middle of the zone';
    brief += `**Hunting:** Primarily ${zone} (VBA: ${avgVBA.toFixed(1)}°)\n`;
  }
  
  return brief;
}

export function ScoutBriefGenerator(props: ScoutBriefGeneratorProps) {
  const [loading, setLoading] = useState(false);
  const [brief, setBrief] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    
    try {
      // Build weapon metrics context for AI
      let weaponContext = '';
      if (props.weaponMetrics) {
        const wm = props.weaponMetrics;
        const metrics = [];
        if (wm.wipIndex !== null) metrics.push(`WIP Index: ${wm.wipIndex} (${getWeaponGrade(wm.wipIndex)}) - measures bat whip efficiency`);
        if (wm.planeIntegrity !== null) metrics.push(`Plane Integrity: ${wm.planeIntegrity} (${getWeaponGrade(wm.planeIntegrity)}) - swing plane consistency`);
        if (wm.squareUpConsistency !== null) metrics.push(`Square-Up: ${wm.squareUpConsistency} (${getWeaponGrade(wm.squareUpConsistency)}) - barrel contact repeatability`);
        if (wm.impactMomentum !== null) metrics.push(`Impact Momentum: ${wm.impactMomentum} (${getWeaponGrade(wm.impactMomentum)}) - power at contact`);
        
        if (metrics.length > 0) {
          weaponContext = `\n\nDiamond Kinetics Weapon Metrics (20-80 scout scale, 50=average, 55+=above avg, 65+=plus):\n${metrics.join('\n')}`;
        }
      }

      // Try to call the AI endpoint first
      const { data, error } = await supabase.functions.invoke('ask-the-lab', {
        body: {
          question: `Generate an 8th-grade friendly scout brief for ${props.playerName}. 
            Their 4B scores are: Brain ${props.brainScore ?? 'N/A'}, Body ${props.bodyScore ?? 'N/A'}, 
            Bat ${props.batScore ?? 'N/A'}, Ball ${props.ballScore ?? 'N/A'}, Composite ${props.compositeScore ?? 'N/A'}.
            Weakest link: ${props.weakestLink ?? 'None identified'}.
            ${props.leaks?.length ? `Detected leaks: ${props.leaks.join(', ')}` : ''}
            ${props.projectedEV ? `Projected exit velo: ${props.projectedEV} mph` : ''}
            ${props.avgVBA !== null ? `Average VBA: ${props.avgVBA}°` : ''}${weaponContext}
            
            Write it like a coach talking to a middle schooler - simple words, encouraging tone, 
            focus on what they can actually DO to get better. Include insights about their weapon metrics 
            (WIP Index shows bat whip, Plane Integrity shows consistency, Square-Up shows barrel contact, 
            Impact Momentum shows power delivery).`,
          context: 'scout_brief'
        }
      });

      if (error || !data?.answer) {
        // Fallback to local generation
        console.log('Using local brief generation');
        setBrief(generateLocalBrief(props));
      } else {
        setBrief(data.answer);
      }
      
      toast.success("Scout brief generated!");
    } catch (err) {
      console.error('Brief generation error:', err);
      // Use local fallback
      setBrief(generateLocalBrief(props));
      toast.success("Scout brief generated!");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (brief) {
      navigator.clipboard.writeText(brief);
      setCopied(true);
      toast.success("Copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-slate-900 to-slate-800">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-primary flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Scout Brief
          </CardTitle>
          <Badge variant="outline" className="text-[10px] border-primary/50 text-primary">
            8TH-GRADE FRIENDLY
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!brief ? (
          <div className="text-center py-8">
            <Sparkles className="h-12 w-12 mx-auto text-primary mb-4" />
            <p className="text-sm text-slate-300 mb-2">
              Get a plain-English summary of your swing
            </p>
            <p className="text-xs text-slate-500 mb-6">
              No confusing numbers - just what's working and what to fix
            </p>
            <Button 
              onClick={handleGenerate}
              disabled={loading}
              className="bg-primary hover:bg-primary/90 text-white font-bold px-8 py-6 text-lg"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5 mr-2" />
                  Generate Scout Brief
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Generated Brief */}
            <div className="bg-slate-800/70 rounded-lg p-4 border border-slate-700">
              <pre className="whitespace-pre-wrap text-sm text-slate-200 font-sans leading-relaxed">
                {brief}
              </pre>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={handleCopy}
                className="flex-1 border-slate-600"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Brief
                  </>
                )}
              </Button>
              <Button 
                variant="outline"
                onClick={() => setBrief(null)}
                className="border-slate-600"
              >
                Reset
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
