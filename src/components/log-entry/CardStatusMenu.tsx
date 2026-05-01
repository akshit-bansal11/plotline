// File: src/components/log-entry/CardStatusMenu.tsx
// Purpose: Dropdown menu for changing media status directly from the card

"use client";

// ─── React
import React from "react";

// ─── Internal — types
import type { EntryStatus } from "@/context/DataContext";
import { getStatusOptionsForMediaType } from "@/types/log-entry";
import type { EntryMediaType } from "@/types/log-entry";

// ─── Internal — utils
import { cn, entryStatusLabels } from "@/utils";

interface CardStatusMenuProps {
  currentStatus: EntryStatus;
  mediaType: EntryMediaType;
  onStatusChange: (status: EntryStatus) => void;
  onClose: () => void;
  className?: string;
}

export function CardStatusMenu({
  currentStatus,
  mediaType,
  onStatusChange,
  onClose,
  className,
}: CardStatusMenuProps) {
  const statusOptions = getStatusOptionsForMediaType(mediaType);

  return (
    <div 
      className={cn(
        "absolute top-full left-0 mt-1 w-32 bg-zinc-900 border border-white/10 rounded-lg shadow-2xl z-50 overflow-hidden py-1",
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {statusOptions.map((option) => (
        <button
          key={option}
          onClick={() => {
            onStatusChange(option);
            onClose();
          }}
          className={cn(
            "w-full text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors",
            currentStatus === option
              ? "bg-blue-600/10 text-blue-400"
              : "text-zinc-400 hover:bg-white/5 hover:text-white"
          )}
        >
          {entryStatusLabels[option]}
        </button>
      ))}
    </div>
  );
}
