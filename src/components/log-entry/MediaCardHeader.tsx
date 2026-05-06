// File: src/components/log-entry/MediaCardHeader.tsx
// Purpose: Top-level badges (Rating, Status) for the media card

"use client";

// ─── React

// ─── Icons
import { Star } from "lucide-react";

// ─── Internal — types
import type { EntryStatus } from "@/context/DataContext";

// ─── Internal — utils
import { cn, entryStatusLabels } from "@/utils";

interface MediaCardHeaderProps {
  userRating?: number | null;
  status?: EntryStatus;
  showStatusControl?: boolean;
  onStatusClick?: () => void;
  onRatingClick?: () => void;
}

export function MediaCardHeader({
  userRating,
  status,
  showStatusControl,
  onStatusClick,
  onRatingClick,
}: MediaCardHeaderProps) {
  return (
    <div className="absolute top-2 left-2 right-2 flex justify-between items-start z-10 pointer-events-none">
      {/* Rating Badge */}
      {userRating && (
        <div className="pointer-events-auto">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRatingClick?.();
            }}
            className="px-2 py-1 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 text-[11px] font-bold text-yellow-400 flex items-center gap-1 shadow-xl hover:bg-black/80 transition-colors"
          >
            <Star className="w-3 h-3 fill-yellow-400" />
            {userRating}
          </button>
        </div>
      )}

      {/* Status Badge */}
      {showStatusControl && status && (
        <div className="pointer-events-auto">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onStatusClick?.();
            }}
            className={cn(
              "px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border backdrop-blur-md transition-all shadow-xl",
              status === "completed"
                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                : "bg-blue-500/20 border-blue-500/40 text-blue-300",
            )}
          >
            {entryStatusLabels[status]}
          </button>
        </div>
      )}
    </div>
  );
}
