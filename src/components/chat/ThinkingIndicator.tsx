import { Loader2 } from 'lucide-react';

export function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>Coach Rick is thinking</span>
      <span className="inline-flex">
        <span className="animate-[bounce_1s_ease-in-out_infinite]">.</span>
        <span className="animate-[bounce_1s_ease-in-out_0.2s_infinite]">.</span>
        <span className="animate-[bounce_1s_ease-in-out_0.4s_infinite]">.</span>
      </span>
    </div>
  );
}
