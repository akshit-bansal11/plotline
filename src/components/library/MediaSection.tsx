// File: src/components/library/MediaSection.tsx
// Purpose: Orchestrates filtering and animated visibility for media item groups

"use client";

// ─── React
import { useMemo, useRef, useState } from "react";

// ─── Third-party: Framer Motion
import { motion, useInView } from "motion/react";

// ─── Internal — hooks
import { useFilteredItems } from "@/hooks/useFilteredItems";

// ─── Internal — utils
import { cn } from "@/utils";

interface MediaSectionProps<TItem> {
  title: string;
  href?: string;
  items: TItem[];
  getGenresThemes: (item: TItem) => string[] | null | undefined;
  getFilterValues?: (item: TItem) => Array<string | number | null | undefined> | null | undefined;
  children: (filteredItems: TItem[]) => React.ReactNode;
  className?: string;
  filterRaw?: string;
  onFilterRawChange?: (next: string) => void;
  showFilterInput?: boolean;
}

/**
 * Provides a filtered subset of items to its children and handles intersection animations.
 */
export function MediaSection<TItem>({
  items,
  getGenresThemes,
  getFilterValues,
  children,
  className,
  filterRaw: externalFilterRaw,
  onFilterRawChange,
  showFilterInput = true,
}: MediaSectionProps<TItem>) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  
  const { filterRaw, setFilterRaw, filteredItems } = useFilteredItems({
    items,
    getGenresThemes,
    getFilterValues,
    externalFilterRaw,
    onFilterRawChange,
  });

  return (
    <section ref={ref} className={cn("py-8 space-y-8", className)}>
      {showFilterInput && (
        <div className="w-full px-4 md:px-8 max-w-2xl">
          <div className="relative group">
            <input
              value={filterRaw}
              onChange={(e) => setFilterRaw(e.target.value)}
              placeholder="Filter by tags, year, or rating (e.g. action, 2024, 8.5)..."
              className="w-full rounded-2xl bg-zinc-900/50 border border-zinc-800 px-5 py-4 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/30 transition-all shadow-inner"
            />
          </div>
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full"
      >
        <div className="px-4 md:px-8">
          {children(filteredItems)}
        </div>
      </motion.div>
    </section>
  );
}
