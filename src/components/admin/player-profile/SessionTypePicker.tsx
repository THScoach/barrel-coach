/**
 * Session Type Picker — pill selector for session_type + drill_name input
 */
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type SessionType = 'bp' | 'drill' | 'game' | 'tee' | 'live_pitching';

const SESSION_TYPE_OPTIONS: { value: SessionType; label: string }[] = [
  { value: 'bp', label: 'BP' },
  { value: 'drill', label: 'DRILL' },
  { value: 'game', label: 'GAME' },
  { value: 'tee', label: 'TEE' },
  { value: 'live_pitching', label: 'LIVE' },
];

interface SessionTypePickerProps {
  sessionType: SessionType;
  drillName: string;
  onSessionTypeChange: (type: SessionType) => void;
  onDrillNameChange: (name: string) => void;
}

export function SessionTypePicker({
  sessionType,
  drillName,
  onSessionTypeChange,
  onDrillNameChange,
}: SessionTypePickerProps) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-slate-400 mb-1.5 block">Session Type</label>
        <div className="flex gap-1.5 flex-wrap">
          {SESSION_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onSessionTypeChange(opt.value)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide border transition-all",
                sessionType === opt.value
                  ? "bg-[#E63946]/15 text-[#E63946] border-[#E63946]/40"
                  : "bg-transparent text-slate-400 border-slate-700 hover:border-slate-500"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {sessionType === 'drill' && (
        <div>
          <label className="text-xs text-slate-400 mb-1 block">
            Drill Name <span className="text-red-400">*</span>
          </label>
          <Input
            value={drillName}
            onChange={(e) => onDrillNameChange(e.target.value)}
            placeholder="e.g. Platform Step-Down, Quan Rope, Tee Hip Load"
            className="h-9 bg-slate-800 border-slate-700 text-white text-sm placeholder:text-slate-600"
          />
        </div>
      )}
    </div>
  );
}
