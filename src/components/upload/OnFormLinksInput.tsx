import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { UploadFile } from "@/types/upload";
import { Link2 } from "lucide-react";

interface OnFormLinksInputProps {
  onAddFiles: (files: UploadFile[]) => void;
  disabled?: boolean;
}

export function OnFormLinksInput({ onAddFiles, disabled }: OnFormLinksInputProps) {
  const [onformLinks, setOnformLinks] = useState("");

  const handleAddLinks = () => {
    const links = onformLinks
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("https://link.getonform.com/"));

    if (links.length === 0) {
      toast.error("No valid OnForm links found. Links should start with https://link.getonform.com/");
      return;
    }

    const newFiles: UploadFile[] = links.map((link) => {
      const url = new URL(link);
      const videoId = url.searchParams.get("id") || "unknown";
      return {
        id: crypto.randomUUID(),
        onformId: videoId,
        url: link,
        status: "pending",
        progress: 0,
        source: "onform",
        name: `OnForm video ${videoId.slice(0, 8)}…`,
      };
    });

    onAddFiles(newFiles);
    setOnformLinks("");
    toast.success(`Added ${newFiles.length} OnForm video(s)`);
  };

  return (
    <div className="space-y-3">
      <Label className="text-slate-300">Paste OnForm Video Links</Label>
      <Textarea
        placeholder={`https://link.getonform.com/view?id=...\nhttps://link.getonform.com/view?id=...\nhttps://link.getonform.com/view?id=...`}
        rows={5}
        value={onformLinks}
        onChange={(e) => setOnformLinks(e.target.value)}
        disabled={disabled}
        className="bg-slate-800 border-slate-700 text-white font-mono text-sm placeholder:text-slate-600"
      />
      <p className="text-xs text-slate-500">
        One link per line. Open OnForm → select video → Share → Copy Link.
      </p>
      <Button
        onClick={handleAddLinks}
        variant="outline"
        disabled={disabled || !onformLinks.trim()}
        className="border-slate-700 text-slate-300 hover:text-white"
      >
        <Link2 className="w-4 h-4 mr-2" />
        Add Links
      </Button>
    </div>
  );
}
