// File: src/components/log-entry/CardRatingMenu.tsx
// Purpose: Dropdown menu for changing user rating directly from the card

"use client";

// ─── Icons
import { Star } from "lucide-react";

// ─── Internal — utils
import { cn } from "@/utils";

interface CardRatingMenuProps {
  currentRating?: number | null;
  onRatingChange: (rating: number) => void;
  onClose: () => void;
  className?: string;
}

export function CardRatingMenu({
  currentRating,
  onRatingChange,
  onClose,
  className,
}: CardRatingMenuProps) {
  return (
    <div
      role="menu"
      className={cn(
        "absolute top-full left-0 mt-1 w-24 bg-zinc-900 border border-white/10 rounded-lg shadow-2xl z-50 overflow-hidden py-1",
        className,
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((num) => (
        <button
          key={num}
          type="button"
          role="menuitem"
          onClick={() => {
            onRatingChange(num);
            onClose();
          }}
          className={cn(
            "w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-bold transition-colors",
            currentRating === num
              ? "bg-yellow-400/10 text-yellow-400"
              : "text-zinc-400 hover:bg-white/5 hover:text-white",
          )}
        >
          <span>{num}</span>
          <Star className={cn("w-3 h-3", currentRating === num && "fill-yellow-400")} />
        </button>
      ))}
    </div>
  );
}
