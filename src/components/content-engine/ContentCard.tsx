import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Mic, Video, MessageSquare, FileText, 
  Check, X, Edit, Copy, Clock,
  Instagram, Twitter, Youtube, Facebook,
  Sparkles, ChevronDown, ChevronUp
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface ContentOutput {
  id: string;
  platform: string;
  formatted_content: string;
  hook?: string;
  status: string;
  hashtags?: string[];
}

interface ContentCardProps {
  id: string;
  sourceType: 'conversation' | 'voice' | 'video' | 'session' | 'text';
  rawContent?: string;
  transcript?: string;
  extractedInsights?: any[];
  topics?: string[];
  contentType?: string;
  status: string;
  createdAt: string;
  outputs?: ContentOutput[];
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onEdit?: (id: string) => void;
  onGenerateMore?: (id: string) => void;
}

const sourceIcons = {
  conversation: MessageSquare,
  voice: Mic,
  video: Video,
  session: FileText,
  text: FileText,
};

const platformIcons: Record<string, React.ElementType> = {
  instagram_reel: Instagram,
  instagram_post: Instagram,
  instagram_story: Instagram,
  twitter: Twitter,
  twitter_thread: Twitter,
  youtube_short: Youtube,
  facebook: Facebook,
  tiktok: Video,
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  processing: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  ready: "bg-green-500/10 text-green-600 border-green-500/20",
  approved: "bg-primary/10 text-primary border-primary/20",
  archived: "bg-muted text-muted-foreground",
};

export function ContentCard({
  id,
  sourceType,
  rawContent,
  transcript,
  extractedInsights = [],
  topics = [],
  contentType,
  status,
  createdAt,
  outputs = [],
  onApprove,
  onReject,
  onEdit,
  onGenerateMore,
}: ContentCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedOutput, setSelectedOutput] = useState<string | null>(
    outputs[0]?.id || null
  );

  const SourceIcon = sourceIcons[sourceType];
  const displayContent = transcript || rawContent || "";
  const truncatedContent = displayContent.slice(0, 200);
  const hasMore = displayContent.length > 200;

  const currentOutput = outputs.find(o => o.id === selectedOutput);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <SourceIcon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium capitalize">{sourceType}</span>
                <Badge variant="outline" className={cn("text-xs", statusColors[status])}>
                  {status}
                </Badge>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
              </div>
            </div>
          </div>
          
          <div className="flex gap-1">
            {status === 'ready' && onApprove && (
              <Button size="sm" variant="ghost" onClick={() => onApprove(id)}>
                <Check className="h-4 w-4 text-green-600" />
              </Button>
            )}
            {status === 'ready' && onReject && (
              <Button size="sm" variant="ghost" onClick={() => onReject(id)}>
                <X className="h-4 w-4 text-destructive" />
              </Button>
            )}
            {onEdit && (
              <Button size="sm" variant="ghost" onClick={() => onEdit(id)}>
                <Edit className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Topics */}
        {topics.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {topics.map(topic => (
              <Badge key={topic} variant="secondary" className="text-xs">
                {topic.replace(/_/g, ' ')}
              </Badge>
            ))}
            {contentType && (
              <Badge variant="outline" className="text-xs">
                {contentType.replace(/_/g, ' ')}
              </Badge>
            )}
          </div>
        )}

        {/* Original content preview */}
        <div className="p-3 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground">
            {expanded ? displayContent : truncatedContent}
            {hasMore && !expanded && "..."}
          </p>
          {hasMore && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="mt-2 h-6 text-xs"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-3 w-3 mr-1" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3 mr-1" />
                  Show more
                </>
              )}
            </Button>
          )}
        </div>

        {/* Extracted insights */}
        {extractedInsights.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              Extracted Insights ({extractedInsights.length})
            </h4>
            <div className="space-y-1">
              {extractedInsights.slice(0, 3).map((insight, i) => (
                <div key={i} className="text-sm p-2 bg-primary/5 rounded border-l-2 border-primary">
                  "{insight.quote || insight.text || insight}"
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Platform outputs */}
        {outputs.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Ready for Platforms</h4>
            
            {/* Platform tabs */}
            <div className="flex gap-1 flex-wrap">
              {outputs.map(output => {
                const PlatformIcon = platformIcons[output.platform] || FileText;
                return (
                  <Button
                    key={output.id}
                    variant={selectedOutput === output.id ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => setSelectedOutput(output.id)}
                  >
                    <PlatformIcon className="h-3 w-3" />
                    {output.platform.replace(/_/g, ' ')}
                  </Button>
                );
              })}
            </div>

            {/* Selected output content */}
            {currentOutput && (
              <div className="relative p-3 bg-card border rounded-lg">
                {currentOutput.hook && (
                  <p className="font-semibold mb-2">{currentOutput.hook}</p>
                )}
                <p className="text-sm whitespace-pre-wrap">
                  {currentOutput.formatted_content}
                </p>
                {currentOutput.hashtags && currentOutput.hashtags.length > 0 && (
                  <p className="text-sm text-primary mt-2">
                    {currentOutput.hashtags.map(h => `#${h}`).join(' ')}
                  </p>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="absolute top-2 right-2 h-7"
                  onClick={() => copyToClipboard(currentOutput.formatted_content)}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Generate more button */}
        {onGenerateMore && status === 'ready' && (
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full gap-2"
            onClick={() => onGenerateMore(id)}
          >
            <Sparkles className="h-4 w-4" />
            Generate More Formats
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
