import { useState, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Upload, FileSpreadsheet, Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// DK CSV column → internal field mapping
const COLUMN_MAP: Record<string, string> = {
  speedBarrelMax: "bat_speed_mph",
  controlApproachAngleImpact: "attack_angle_deg",
  speedHandsMax: "hand_speed_mph",
  quicknessTriggerImpact: "time_to_impact_ms",
  percentageOnSwingPlane: "on_plane_pct",
  controlHandCastMax: "hand_cast",
  controlBatVerticalAngleImpact: "vertical_bat_angle",
  swingPlaneSteepnessAngle: "swing_plane_steepness",
};

interface ParsedSwing {
  swing_number: number;
  bat_speed_mph: number | null;
  attack_angle_deg: number | null;
  hand_speed_mph: number | null;
  on_plane_pct: number | null;
  time_to_impact_ms: number | null;
  hand_cast: number | null;
  vertical_bat_angle: number | null;
  swing_plane_steepness: number | null;
  raw: Record<string, string>;
}

interface DKCsvImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DKCsvImportModal({ open, onOpenChange }: DKCsvImportModalProps) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [parsedSwings, setParsedSwings] = useState<ParsedSwing[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: players = [] } = useQuery({
    queryKey: ["players-list-dk-import"],
    queryFn: async () => {
      const { data } = await supabase
        .from("players")
        .select("id, name, email")
        .order("name");
      return data || [];
    },
    enabled: open,
  });

  const selectedPlayer = players.find((p) => p.id === selectedPlayerId);

  const parseCSV = useCallback((text: string) => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) return [];

    const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));

    const swings: ParsedSwing[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
      const raw: Record<string, string> = {};
      headers.forEach((h, idx) => {
        raw[h] = values[idx] || "";
      });

      const num = (key: string) => {
        const v = raw[key];
        if (!v || v === "" || v === "null" || v === "N/A") return null;
        const n = parseFloat(v);
        return isNaN(n) ? null : Math.round(n * 100) / 100;
      };

      swings.push({
        swing_number: i,
        bat_speed_mph: num("speedBarrelMax"),
        attack_angle_deg: num("controlApproachAngleImpact"),
        hand_speed_mph: num("speedHandsMax"),
        on_plane_pct: num("percentageOnSwingPlane"),
        time_to_impact_ms: num("quicknessTriggerImpact"),
        hand_cast: num("controlHandCastMax"),
        vertical_bat_angle: num("controlBatVerticalAngleImpact"),
        swing_plane_steepness: num("swingPlaneSteepnessAngle"),
        raw,
      });
    }
    return swings.filter((s) => s.bat_speed_mph !== null);
  }, []);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.name.endsWith(".csv")) {
        toast.error("Please upload a .csv file");
        return;
      }
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const swings = parseCSV(text);
        if (swings.length === 0) {
          toast.error("No valid swings found in CSV. Check column headers.");
          return;
        }
        setParsedSwings(swings);
        toast.success(`Parsed ${swings.length} swings from ${file.name}`);
      };
      reader.readAsText(file);
    },
    [parseCSV]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleImport = async () => {
    if (!selectedPlayerId || parsedSwings.length === 0) return;
    setImporting(true);

    try {
      // 1. Create sensor_session
      const batSpeeds = parsedSwings
        .map((s) => s.bat_speed_mph)
        .filter(Boolean) as number[];
      const avg = batSpeeds.reduce((a, b) => a + b, 0) / batSpeeds.length;
      const max = Math.max(...batSpeeds);

      const { data: session, error: sessionError } = await supabase
        .from("sensor_sessions")
        .insert({
          player_id: selectedPlayerId,
          session_date: new Date().toISOString().split("T")[0],
          total_swings: parsedSwings.length,
          avg_bat_speed: Math.round(avg * 10) / 10,
          max_bat_speed: Math.round(max * 10) / 10,
          status: "complete",
          environment: "dk_csv_import",
          synced_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (sessionError) throw sessionError;

      // 2. Insert sensor_swings
      const swingRows = parsedSwings.map((s) => ({
        session_id: session.id,
        player_id: selectedPlayerId,
        swing_number: s.swing_number,
        bat_speed_mph: s.bat_speed_mph,
        attack_angle_deg: s.attack_angle_deg,
        hand_speed_mph: s.hand_speed_mph,
        trigger_to_impact_ms: s.time_to_impact_ms,
        swing_plane_tilt_deg: s.swing_plane_steepness,
        hand_to_bat_ratio:
          s.bat_speed_mph && s.hand_speed_mph
            ? Math.round((s.hand_speed_mph / s.bat_speed_mph) * 100) / 100
            : null,
        is_valid: true,
        occurred_at: new Date().toISOString(),
        raw_dk_data: { csv_row: s.raw, source: "dk_csv_import" },
      }));

      const { error: swingsError } = await supabase
        .from("sensor_swings")
        .insert(swingRows);

      if (swingsError) throw swingsError;

      toast.success(
        `Imported ${parsedSwings.length} swings. Session ID: ${session.id.slice(0, 8)}…`
      );
      resetAndClose();
    } catch (err: any) {
      console.error("DK CSV Import error:", err);
      toast.error(err.message || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const resetAndClose = () => {
    setSelectedPlayerId(null);
    setParsedSwings([]);
    setFileName(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="max-w-2xl bg-slate-900 border-slate-700 text-slate-50 max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FileSpreadsheet className="h-5 w-5 text-orange-400" />
            Import Diamond Kinetics Data
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Upload a DK CSV export to create a sensor session.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Player selector */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-300">Player</label>
            <Popover open={playerOpen} onOpenChange={setPlayerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={playerOpen}
                  className="w-full justify-between border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700"
                >
                  {selectedPlayer
                    ? selectedPlayer.name || selectedPlayer.email
                    : "Select a player…"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0 bg-slate-800 border-slate-700" align="start">
                <Command className="bg-slate-800">
                  <CommandInput placeholder="Search players…" className="text-slate-200" />
                  <CommandList>
                    <CommandEmpty className="text-slate-400 py-4 text-center text-sm">
                      No players found
                    </CommandEmpty>
                    <CommandGroup>
                      {players.map((p) => (
                        <CommandItem
                          key={p.id}
                          value={`${p.name || ""} ${p.email || ""}`}
                          onSelect={() => {
                            setSelectedPlayerId(p.id);
                            setPlayerOpen(false);
                          }}
                          className="text-slate-200"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedPlayerId === p.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {p.name || "Unnamed"}{" "}
                          <span className="ml-2 text-xs text-slate-500">{p.email}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* CSV Upload */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-300">CSV File</label>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                dragOver
                  ? "border-orange-400 bg-orange-400/10"
                  : "border-slate-600 hover:border-slate-500 bg-slate-800/50"
              )}
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-slate-400" />
              {fileName ? (
                <p className="text-sm text-slate-300">
                  <span className="font-medium text-orange-400">{fileName}</span> —{" "}
                  {parsedSwings.length} swings parsed
                </p>
              ) : (
                <p className="text-sm text-slate-400">
                  Drag & drop a .csv file or{" "}
                  <span className="text-orange-400 underline">browse</span>
                </p>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
            </div>
          </div>

          {/* Parse preview */}
          {parsedSwings.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
                Preview ({parsedSwings.length} swings)
              </label>
              <div className="max-h-52 overflow-auto rounded-lg border border-slate-700">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700 hover:bg-transparent">
                      <TableHead className="text-slate-400 text-xs">#</TableHead>
                      <TableHead className="text-slate-400 text-xs">Bat Speed</TableHead>
                      <TableHead className="text-slate-400 text-xs">Attack Angle</TableHead>
                      <TableHead className="text-slate-400 text-xs">Hand Speed</TableHead>
                      <TableHead className="text-slate-400 text-xs">On-Plane %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedSwings.map((s) => (
                      <TableRow key={s.swing_number} className="border-slate-700/50">
                        <TableCell className="text-slate-400 text-xs py-1.5">
                          {s.swing_number}
                        </TableCell>
                        <TableCell className="text-slate-200 text-xs py-1.5 font-mono">
                          {s.bat_speed_mph ?? "—"}
                        </TableCell>
                        <TableCell className="text-slate-200 text-xs py-1.5 font-mono">
                          {s.attack_angle_deg ?? "—"}
                        </TableCell>
                        <TableCell className="text-slate-200 text-xs py-1.5 font-mono">
                          {s.hand_speed_mph ?? "—"}
                        </TableCell>
                        <TableCell className="text-slate-200 text-xs py-1.5 font-mono">
                          {s.on_plane_pct != null ? `${s.on_plane_pct}%` : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Confirm */}
          <Button
            onClick={handleImport}
            disabled={!selectedPlayerId || parsedSwings.length === 0 || importing}
            className="w-full bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 text-white font-semibold"
          >
            {importing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing…
              </>
            ) : (
              `Import ${parsedSwings.length} Swings`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
