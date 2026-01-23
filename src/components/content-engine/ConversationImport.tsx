import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConversationImportProps {
  onImport: (content: string, source: 'claude' | 'chatgpt' | 'other') => Promise<void>;
}

const EXAMPLE_PLACEHOLDER = `Paste a conversation here...

Example:

User: What makes a good swing tempo?

Rick: Look, tempo is everything. Most people think it's about swinging fast - it's not. It's about the SEQUENCE. The hips fire, then the torso rotates, then the arms whip through. When that sequence is right, the barrel shows up on time every time.

The data shows X, but here's WHY - timing creates bat speed, not effort...`;

export function ConversationImport({ onImport }: ConversationImportProps) {
  const [content, setContent] = useState("");
  const [source, setSource] = useState<'claude' | 'chatgpt' | 'other'>('claude');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleImport = async () => {
    if (!content.trim()) return;
    
    setIsProcessing(true);
    try {
      await onImport(content, source);
      setContent("");
    } finally {
      setIsProcessing(false);
    }
  };

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  const hasEnoughContent = wordCount >= 50;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Import Conversation
        </CardTitle>
        <CardDescription>
          Paste a conversation from Claude, ChatGPT, or any AI chat. The system will extract
          insights, quotes, and teaching moments.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Source selector */}
        <div className="flex gap-2">
          <Badge 
            variant={source === 'claude' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setSource('claude')}
          >
            Claude
          </Badge>
          <Badge 
            variant={source === 'chatgpt' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setSource('chatgpt')}
          >
            ChatGPT
          </Badge>
          <Badge 
            variant={source === 'other' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setSource('other')}
          >
            Other
          </Badge>
        </div>

        {/* Text area */}
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={EXAMPLE_PLACEHOLDER}
          className="min-h-[300px] font-mono text-sm"
        />

        {/* Stats */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span className={cn(
            "transition-colors",
            hasEnoughContent ? "text-green-600" : "text-orange-500"
          )}>
            {wordCount} words {!hasEnoughContent && "(need 50+ for best results)"}
          </span>
          <span>Source: {source}</span>
        </div>

        {/* Submit button */}
        <Button 
          onClick={handleImport} 
          disabled={!hasEnoughContent || isProcessing}
          className="w-full gap-2"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Extract Insights
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
