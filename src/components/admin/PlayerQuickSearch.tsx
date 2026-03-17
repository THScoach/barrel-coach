import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

export function PlayerQuickSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const { data: results } = useQuery({
    queryKey: ["player-quick-search", query],
    queryFn: async () => {
      if (query.length < 2) return [];
      const { data } = await supabase
        .from("player_profiles")
        .select("id, first_name, last_name, organization, level")
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
        .order("last_name")
        .limit(8);
      return data || [];
    },
    enabled: query.length >= 2,
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (id: string) => {
    navigate(`/admin/players/${id}`);
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative hidden md:block">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => query.length >= 2 && setOpen(true)}
          placeholder="Find player…"
          className="h-9 w-48 pl-8 pr-8 bg-slate-800/60 border-slate-700 text-slate-200 placeholder:text-slate-500 text-sm focus:w-64 transition-all"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setOpen(false); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && results && results.length > 0 && (
        <div className="absolute top-full mt-1 left-0 w-72 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden">
          {results.map((p) => (
            <button
              key={p.id}
              onClick={() => handleSelect(p.id)}
              className="w-full text-left px-3 py-2.5 hover:bg-slate-800 transition-colors flex items-center justify-between"
            >
              <div>
                <span className="text-sm font-medium text-white">
                  {p.first_name} {p.last_name}
                </span>
                <span className="block text-xs text-slate-500">
                  {[p.organization, p.level].filter(Boolean).join(" • ") || "—"}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {open && query.length >= 2 && results && results.length === 0 && (
        <div className="absolute top-full mt-1 left-0 w-72 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 p-3">
          <p className="text-xs text-slate-500 text-center">No players found</p>
        </div>
      )}
    </div>
  );
}
