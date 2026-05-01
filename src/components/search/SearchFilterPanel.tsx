// File: src/components/search/SearchFilterPanel.tsx
// Purpose: UI panel for configuring search filters (media type, status, year, genres, etc.)

// ─── React
import React from "react";

// ─── Icons
import { Filter, X, ChevronDown, Check } from "lucide-react";

// ─── Internal — utils/search
import {
  GLOBAL_SEARCH_TYPE_OPTIONS,
  GLOBAL_SEARCH_SUBTYPE_OPTIONS,
  SHARED_GENRE_OPTIONS,
  SEARCH_STATUS_OPTIONS,
  ANIME_STUDIO_OPTIONS,
  GAME_PLATFORM_OPTIONS,
  MANGA_SERIALIZATION_OPTIONS,
  getYearFilterOptions,
  type ApiSearchType,
  type ApiSearchStatus
} from "@/utils/searchFilters";

// ─── Internal — utils
import { cn } from "@/utils";

interface SearchFilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  filters: {
    type: ApiSearchType | null;
    status: ApiSearchStatus | null;
    genres: string[];
    yearMin: number | null;
    yearMax: number | null;
    platform: string | null;
    studio: string | null;
  };
  setFilters: (filters: any) => void;
  onApply: () => void;
  onReset: () => void;
}

/**
 * Renders a side or dropdown panel for advanced search filtering.
 */
export function SearchFilterPanel({
  isOpen,
  onClose,
  filters,
  setFilters,
  onApply,
  onReset
}: SearchFilterPanelProps) {
  if (!isOpen) return null;

  const updateFilter = (key: string, value: any) => {
    setFilters((prev: any) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="absolute top-full right-0 mt-2 w-80 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-[100] p-5 flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-zinc-100">
          <Filter className="w-4 h-4 text-zinc-500" />
          <span className="text-sm font-bold uppercase tracking-widest">Filters</span>
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-5 overflow-y-auto max-h-[60vh] pr-2 scrollbar-thin scrollbar-thumb-zinc-800">
        {/* Media Type */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">Media Type</label>
          <div className="grid grid-cols-2 gap-2">
            {GLOBAL_SEARCH_TYPE_OPTIONS.map((opt) => (
              <FilterButton
                key={opt.value}
                label={opt.label}
                active={filters.type === opt.value}
                onClick={() => updateFilter("type", filters.type === opt.value ? null : opt.value)}
              />
            ))}
          </div>
        </div>

        {/* Status */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">Status</label>
          <div className="grid grid-cols-2 gap-2">
            {SEARCH_STATUS_OPTIONS.map((opt) => (
              <FilterButton
                key={opt.value}
                label={opt.label}
                active={filters.status === opt.value}
                onClick={() => updateFilter("status", filters.status === opt.value ? null : opt.value)}
              />
            ))}
          </div>
        </div>

        {/* Year Range */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">Year</label>
          <select 
            value={filters.yearMin || ""}
            onChange={(e) => {
              const val = e.target.value ? Number(e.target.value) : null;
              updateFilter("yearMin", val);
              updateFilter("yearMax", val); // Simple year selection for now
            }}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
          >
            <option value="">Any Year</option>
            {getYearFilterOptions().reverse().map(opt => (
              <option key={opt.id} value={opt.min}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Genres */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">Genres</label>
          <div className="flex flex-wrap gap-2">
            {SHARED_GENRE_OPTIONS.map((genre) => (
              <button
                key={genre}
                onClick={() => {
                  const next = filters.genres.includes(genre)
                    ? filters.genres.filter(g => g !== genre)
                    : [...filters.genres, genre];
                  updateFilter("genres", next);
                }}
                className={cn(
                  "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase transition-all border",
                  filters.genres.includes(genre)
                    ? "bg-blue-600/10 border-blue-500/50 text-blue-400"
                    : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700"
                )}
              >
                {genre}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-4 border-t border-zinc-800">
        <button 
          onClick={onReset}
          className="flex-1 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Reset
        </button>
        <button 
          onClick={onApply}
          className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all shadow-lg shadow-blue-900/20"
        >
          Apply Filters
        </button>
      </div>
    </div>
  );
}

// ─── Sub-components
function FilterButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border flex items-center justify-between",
        active 
          ? "bg-zinc-800 border-zinc-600 text-zinc-100" 
          : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-400"
      )}
    >
      {label}
      {active && <Check className="w-3 h-3 text-blue-400" />}
    </button>
  );
}
