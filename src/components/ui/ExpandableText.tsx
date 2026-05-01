// File: src/components/ui/ExpandableText.tsx
// Purpose: Collapsible text component with "Show more" functionality for long descriptions

"use client";

// ─── React
import { useState } from "react";

// ─── Internal — utils
import { cn } from "@/utils";

export function ExpandableText({ text, className }: { text: string; className?: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 150;

  return (
    <div className={cn("mt-1", className)}>
      <div className={cn("text-xs text-neutral-400", !expanded && isLong && "line-clamp-2")}>
        {text}
      </div>
      {isLong && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-neutral-500 hover:text-neutral-300"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
