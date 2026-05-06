// File: src/components/search/GlobalSearch.tsx
// Purpose: Main search component with multi-provider integration and advanced filtering

"use client";

// ─── Icons
import { Filter, Search, X } from "lucide-react";

// ─── Third-party: Framer Motion
import { AnimatePresence, motion } from "motion/react";
// ─── React & Next
import Image from "next/image";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
// ─── Internal — hooks
import { type SearchResult, useSearchHandlers } from "@/hooks/useSearchHandlers";
// ─── Internal — types
import type { LoggableMedia } from "@/types/log-entry";
// ─── Internal — utils
import { cn } from "@/utils";
// ─── Internal — utils/search
import type { ApiBaseType } from "@/utils/searchFilters";
// ─── Internal — components
import { SearchFilterPanel } from "./SearchFilterPanel";

interface GlobalSearchProps {
  className?: string;
  onSelectMedia?: (media: LoggableMedia) => void;
  onRequireAuth?: () => void;
  disabled?: boolean;
}

export interface GlobalSearchHandle {
  focus: () => void;
}

// ─── Constants
const typeLabels: Record<ApiBaseType, string> = {
  movie: "Movie",
  series: "Series",
  anime: "Anime",
  manga: "Manga",
  game: "Game",
};

// ─────────────────────────────────────────────────────────────────────────────

export const GlobalSearch = forwardRef<GlobalSearchHandle, GlobalSearchProps>(
  ({ className, onSelectMedia, onRequireAuth, disabled = false }, ref) => {
    const {
      query,
      setQuery,
      results,
      isLoading,
      isOpen,
      setIsOpen,
      isFilterOpen,
      setIsFilterOpen,
      filters,
      setFilters,
      resetFilters,
      clearQuery,
      toggleFilter,
      closeSearch,
      selectMedia,
      inputRef,
      focusInput,
    } = useSearchHandlers();

    const containerRef = useRef<HTMLDivElement | null>(null);

    useImperativeHandle(ref, () => ({
      focus: focusInput,
    }));

    // ─── Effect: Click Outside
    useEffect(() => {
      const handleOutsideClick = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          closeSearch();
        }
      };
      document.addEventListener("mousedown", handleOutsideClick);
      return () => document.removeEventListener("mousedown", handleOutsideClick);
    }, [closeSearch]);

    // ─── Actions: Result Selection
    const handleSelect = async (result: SearchResult) => {
      if (disabled) {
        onRequireAuth?.();
        return;
      }
      if (onSelectMedia) {
        await selectMedia(result, onSelectMedia);
      }
    };

    return (
      <div ref={containerRef} className={cn("relative w-full max-w-xl", className)}>
        {/* Search Input Bar */}
        <div className="relative flex items-center bg-zinc-900/50 border border-zinc-800 rounded-full px-4 py-2 focus-within:bg-zinc-900 focus-within:border-zinc-700 transition-all shadow-lg">
          <Search className="w-4 h-4 text-zinc-500 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder="Search for movies, series, anime..."
            className="flex-grow bg-transparent border-none text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none"
          />
          <div className="flex items-center gap-2">
            {query && (
              <button
                type="button"
                onClick={clearQuery}
                className="p-1 text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <div className="w-px h-4 bg-zinc-800" />
            <button
              type="button"
              onClick={toggleFilter}
              className={cn(
                "p-1.5 rounded-full transition-colors",
                isFilterOpen ? "bg-blue-600/10 text-blue-400" : "text-zinc-500 hover:text-zinc-300",
              )}
            >
              <Filter className="w-4 h-4" />
            </button>
          </div>

          {/* Filter Panel (Dropdown) */}
          <SearchFilterPanel
            isOpen={isFilterOpen}
            onClose={() => setIsFilterOpen(false)}
            filters={filters}
            setFilters={setFilters}
            onApply={() => setIsFilterOpen(false)}
            onReset={resetFilters}
          />
        </div>

        {/* Results Dropdown */}
        <AnimatePresence>
          {isOpen && (query || filters.type) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute top-full left-0 right-0 mt-3 bg-[#0f0f0f] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden z-50 max-h-[70vh] flex flex-col"
            >
              {isLoading && (
                <div className="p-4 flex items-center justify-center gap-2 text-zinc-500 text-xs">
                  <div className="w-3 h-3 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
                  Searching Catalog...
                </div>
              )}

              <div className="overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800">
                {results.length > 0 ? (
                  <div className="py-2">
                    {results.map((result) => (
                      <button
                        type="button"
                        key={`${result.type}-${result.id}`}
                        onClick={() => handleSelect(result)}
                        className="w-full flex items-start gap-4 px-4 py-3 hover:bg-zinc-800/50 transition-colors text-left group"
                      >
                        <div className="flex-shrink-0 w-10 h-14 bg-zinc-900 rounded overflow-hidden border border-zinc-800 relative">
                          {result.image ? (
                            <Image
                              src={result.image}
                              alt={result.title}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-700">
                              <Search className="w-4 h-4" />
                            </div>
                          )}
                        </div>
                        <div className="flex-grow min-w-0">
                          <div className="text-sm font-semibold text-zinc-100 truncate group-hover:text-blue-400 transition-colors">
                            {result.title}
                          </div>
                          <div className="text-[11px] text-zinc-500 flex items-center gap-2 mt-0.5">
                            <span className="capitalize">{typeLabels[result.type]}</span>
                            {result.year && (
                              <>
                                <span className="w-1 h-1 rounded-full bg-zinc-700" />
                                <span>{result.year}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  !isLoading && (
                    <div className="p-12 text-center text-zinc-600 text-sm">
                      No results found for your search.
                    </div>
                  )
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  },
);
