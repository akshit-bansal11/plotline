// File: src/components/log-entry/MediaCardFooter.tsx
// Purpose: Bottom-level information and action buttons for the media card

"use client";

// ─── React
import React from "react";

// ─── Icons
import { Edit, Trash2 } from "lucide-react";

interface MediaCardFooterProps {
  title: string;
  year?: string;
  type?: string;
  showActions?: boolean;
  onEdit?: (e: React.MouseEvent) => void;
  onDelete?: (e: React.MouseEvent) => void;
}

export function MediaCardFooter({
  title,
  year,
  type,
  showActions,
  onEdit,
  onDelete,
}: MediaCardFooterProps) {
  return (
    <div className="absolute inset-x-0 bottom-0 p-4 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none">
      <h4 className="text-sm font-bold text-white line-clamp-2 leading-tight drop-shadow-md">
        {title}
      </h4>
      <div className="flex items-center gap-2 mt-1 text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">
        {year && <span>{year}</span>}
        {type && (
          <>
            <span className="w-1 h-1 rounded-full bg-zinc-700" />
            <span>{type}</span>
          </>
        )}
      </div>
      
      {/* Action Row */}
      {showActions && (
        <div className="flex gap-2 mt-3 pointer-events-auto">
          <button 
            onClick={onEdit}
            className="flex-1 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg flex items-center justify-center gap-2 transition-colors border border-white/10"
          >
            <Edit className="w-3 h-3" />
            <span className="text-[10px] font-bold uppercase">Edit</span>
          </button>
          <button 
            onClick={onDelete}
            className="flex-1 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg flex items-center justify-center gap-2 transition-colors border border-red-500/20"
          >
            <Trash2 className="w-3 h-3" />
            <span className="text-[10px] font-bold uppercase">Delete</span>
          </button>
        </div>
      )}
    </div>
  );
}
