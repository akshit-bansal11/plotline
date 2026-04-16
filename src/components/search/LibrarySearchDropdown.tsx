"use client";

import { Search } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ImageWithSkeleton } from "@/components/ui/ImageWithSkeleton";
import { useData } from "@/context/DataContext";
import { cn, entryMediaTypeLabels } from "@/utils";

interface LibrarySearchDropdownProps {
  className?: string;
}

export function LibrarySearchDropdown({ className }: LibrarySearchDropdownProps) {
  const { entries, setSelectedEntry } = useData();

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!containerRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    if (isOpen) {
      window.setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [isOpen]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries.slice(0, 12);

    return entries
      .filter((entry) => {
        if (entry.title.toLowerCase().includes(q)) return true;
        return entry.genresThemes.some((genre) => genre.toLowerCase().includes(q));
      })
      .slice(0, 15);
  }, [entries, query]);

  return (
    <div ref={containerRef} className={cn("relative z-40", className)}>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="rounded-full border border-white/10 bg-neutral-900/40 px-4 py-2 text-xs font-semibold text-neutral-200 transition-colors hover:bg-neutral-900/60"
      >
        Library
      </button>

      <AnimatePresence>
        {isOpen ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute right-0 top-[calc(100%+10px)] w-[min(92vw,420px)] overflow-hidden rounded-2xl border border-white/10 bg-neutral-950/95 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl"
          >
            <div className="border-b border-white/5 p-3">
              <div className="relative">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"
                />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search your library..."
                  className="w-full rounded-xl border border-white/10 bg-neutral-900/70 py-2 pl-9 pr-3 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-white/20"
                />
              </div>
            </div>

            <div className="max-h-[52vh] overflow-y-auto custom-scrollbar">
              {filtered.length === 0 ? (
                <div className="p-4 text-sm text-neutral-500">No local results.</div>
              ) : (
                <div className="py-2">
                  {filtered.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => {
                        setSelectedEntry(entry);
                        setIsOpen(false);
                        setQuery("");
                      }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5"
                    >
                      <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-md bg-neutral-800">
                        {entry.image ? (
                          <ImageWithSkeleton
                            src={entry.image}
                            alt={entry.title}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-neutral-600">
                            <Search size={14} />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-white">
                          {entry.title}
                        </div>
                        <div className="truncate text-xs text-neutral-500">
                          {entry.releaseYear ? `${entry.releaseYear} - ` : ""}
                          {entryMediaTypeLabels[entry.mediaType] || entry.mediaType}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
