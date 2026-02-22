"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Search, Filter, X, Globe } from "lucide-react";
import Image from "next/image";
import { useData, EntryDoc, EntryMediaType, EntryStatus } from "@/context/data-context";
import { AnimatePresence, motion } from "motion/react";
import { entryStatusLabels, entryMediaTypeLabels } from "@/lib/utils";

const mediaTypeLabels: Record<EntryMediaType, string> = entryMediaTypeLabels;

const statusLabels: Record<EntryStatus, string> = entryStatusLabels;

export function GlobalSearch({ onOpenGlobal }: { onOpenGlobal?: () => void }) {
  const { entries, setSelectedEntry } = useData();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [selectedTypes, setSelectedTypes] = useState<EntryMediaType[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<EntryStatus[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [userRatingValue, setUserRatingValue] = useState<number | null>(null);
  const [imdbRatingValue, setImdbRatingValue] = useState<number | null>(null);

  const allGenres = useMemo(() => {
    const genres = new Set<string>();
    entries.forEach((entry) => {
      if (Array.isArray(entry.genresThemes)) {
        entry.genresThemes.forEach((g) => genres.add(g));
      }
    });
    return Array.from(genres).sort();
  }, [entries]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Click outside to close results
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (resultsRef.current && !resultsRef.current.contains(target) && !inputRef.current?.contains(target)) {
        setShowResults(false);
      }
      if (filterRef.current && !filterRef.current.contains(target)) {
        // Don't close filter if clicking the filter button
        const filterBtn = document.getElementById("global-search-filter-btn");
        if (!filterBtn?.contains(target)) {
          setShowFilters(false);
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isUserRatingActive = userRatingValue !== null;
  const isImdbRatingActive = imdbRatingValue !== null;
  const hasActiveFilters =
    selectedTypes.length > 0 ||
    selectedStatus.length > 0 ||
    selectedGenres.length > 0 ||
    isUserRatingActive ||
    isImdbRatingActive;

  const filteredEntries = useMemo(() => {
    if (!debouncedQuery && !hasActiveFilters) return [];

    const lowerQuery = debouncedQuery.toLowerCase();
    return entries
      .filter((entry) => {
        const matchesText =
          !lowerQuery ||
          entry.title.toLowerCase().includes(lowerQuery) ||
          entry.genresThemes.some((g) => g.toLowerCase().includes(lowerQuery));

        if (!matchesText) return false;

        if (selectedTypes.length > 0 && !selectedTypes.includes(entry.mediaType)) return false;

        if (selectedStatus.length > 0 && !selectedStatus.includes(entry.status)) return false;

        if (selectedGenres.length > 0) {
          const hasGenre = entry.genresThemes?.some((g) => selectedGenres.includes(g));
          if (!hasGenre) return false;
        }

        if (isUserRatingActive && userRatingValue !== null) {
          if (typeof entry.userRating !== "number") return false;
          if (entry.userRating < userRatingValue) return false;
        }

        if (isImdbRatingActive && imdbRatingValue !== null) {
          if (typeof entry.imdbRating !== "number") return false;
          if (entry.imdbRating < imdbRatingValue) return false;
        }

        return true;
      })
      .slice(0, 20);
  }, [
    entries,
    debouncedQuery,
    hasActiveFilters,
    isImdbRatingActive,
    isUserRatingActive,
    selectedGenres,
    selectedStatus,
    selectedTypes,
    userRatingValue,
    imdbRatingValue,
  ]);

  const toggleType = (type: EntryMediaType) => {
    setSelectedTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  };

  const toggleStatus = (status: EntryStatus) => {
    setSelectedStatus((prev) => (prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]));
  };

  const toggleGenre = (genre: string) => {
    setSelectedGenres((prev) => (prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]));
  };

  const handleSelect = (entry: EntryDoc) => {
    setSelectedEntry(entry);
    setShowResults(false);
    setQuery("");
  };

  const clearFilters = () => {
    setSelectedTypes([]);
    setSelectedStatus([]);
    setSelectedGenres([]);
    setUserRatingValue(null);
    setImdbRatingValue(null);
  };

  const activeFilterCount = selectedTypes.length + selectedStatus.length + selectedGenres.length + (isUserRatingActive ? 1 : 0) + (isImdbRatingActive ? 1 : 0);

  return (
    <div className="relative z-50">
      {/* Search input bar */}
      <div className="relative flex items-center">
        <div className="relative flex items-center bg-white/5 rounded-full border border-white/5 focus-within:bg-white/10 focus-within:border-white/20 transition-all overflow-hidden w-64 focus-within:w-80 transition-width duration-300">
          <Search size={16} className="text-neutral-400 ml-3 shrink-0" suppressHydrationWarning />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowResults(true);
            }}
            onFocus={() => { if (query || hasActiveFilters) setShowResults(true); }}
            placeholder="Search library..."
            className="w-full bg-transparent border-none text-sm text-white px-3 py-2 focus:outline-none placeholder-neutral-500"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="p-1 mr-1 text-neutral-400 hover:text-white rounded-full hover:bg-white/10"
            >
              <X size={14} suppressHydrationWarning />
            </button>
          )}
          {onOpenGlobal && (
            <button
              id="global-search-mode-btn"
              title="Switch to Global Search"
              onClick={(e) => { e.preventDefault(); onOpenGlobal(); }}
              className="p-2 mr-1 rounded-full transition-colors text-neutral-400 hover:text-white hover:bg-white/10"
            >
              <Globe size={14} suppressHydrationWarning />
            </button>
          )}
          <button
            id="global-search-filter-btn"
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 mr-1 rounded-full transition-colors relative ${showFilters || hasActiveFilters ? 'text-blue-400 bg-blue-400/10' : 'text-neutral-400 hover:text-white hover:bg-white/10'}`}
          >
            <Filter size={14} suppressHydrationWarning />
            {activeFilterCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-500 text-[8px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Results dropdown */}
      <AnimatePresence>
        {showResults && (query || hasActiveFilters) && (
          <motion.div
            ref={resultsRef}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute top-full right-0 mt-2 w-[400px] bg-neutral-950/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
          >
            {hasActiveFilters && (
              <div className="px-4 py-2 border-b border-white/5 flex items-center gap-2 flex-wrap">
                <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">Filters:</span>
                {selectedTypes.map((t) => (
                  <span key={t} className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    {mediaTypeLabels[t]}
                  </span>
                ))}
                {selectedStatus.map((s) => (
                  <span key={s} className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {statusLabels[s]}
                  </span>
                ))}
                {selectedGenres.map((g) => (
                  <span key={g} className="px-1.5 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    {g}
                  </span>
                ))}
                {isUserRatingActive && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Rating ≥ {userRatingValue}
                  </span>
                )}
                {isImdbRatingActive && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    IMDb ≥ {imdbRatingValue?.toFixed(1)}
                  </span>
                )}
              </div>
            )}

            <div className="max-h-[50vh] overflow-y-auto custom-scrollbar">
              {filteredEntries.length > 0 ? (
                <div className="py-2">
                  <div className="px-4 pb-1 text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">
                    {filteredEntries.length} result{filteredEntries.length !== 1 ? "s" : ""}
                  </div>
                  {filteredEntries.map((entry) => (
                    <button
                      key={entry.id}
                      onClick={() => handleSelect(entry)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left group"
                    >
                      <div className="w-10 h-14 bg-neutral-800 rounded overflow-hidden shrink-0 relative">
                        {entry.image ? (
                          <Image src={entry.image} alt={entry.title} fill className="object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-neutral-600">
                            <Search size={16} />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate group-hover:text-blue-200 transition-colors">
                          {entry.title}
                        </div>
                        <div className="text-xs text-neutral-500 truncate mt-0.5">
                          {entry.releaseYear} • {mediaTypeLabels[entry.mediaType]}
                        </div>
                      </div>
                      <div className="shrink-0">
                        <div className={`text-[10px] px-2 py-0.5 rounded-full border ${entry.status === 'completed' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                          entry.status === 'watching' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                            'bg-neutral-800 border-white/10 text-neutral-400'
                          }`}>
                          {statusLabels[entry.status]}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-neutral-500 text-sm">
                  {query ? "No results found." : "Type to search or apply filters…"}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter panel — separate dropdown */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            ref={filterRef}
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full right-0 mt-2 w-[520px] bg-neutral-950/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <span className="text-xs font-semibold text-white uppercase tracking-wider">Filters</span>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-[10px] font-semibold text-neutral-400 hover:text-white transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>
            <div className="p-4 pt-0 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
              <div>
                <div className="text-xs font-semibold text-neutral-500 mb-2 uppercase tracking-wider">Type</div>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(mediaTypeLabels) as EntryMediaType[]).map(type => (
                    <button
                      key={type}
                      onClick={() => toggleType(type)}
                      className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${selectedTypes.includes(type)
                        ? 'bg-blue-500/20 border-blue-500/50 text-blue-200'
                        : 'bg-neutral-800/50 border-white/5 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
                        }`}
                    >
                      {mediaTypeLabels[type]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-neutral-500 mb-2 uppercase tracking-wider">Status</div>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(statusLabels) as EntryStatus[]).map(status => (
                    <button
                      key={status}
                      onClick={() => toggleStatus(status)}
                      className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${selectedStatus.includes(status)
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200'
                        : 'bg-neutral-800/50 border-white/5 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
                        }`}
                    >
                      {statusLabels[status]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-neutral-500 mb-2 uppercase tracking-wider">Genres</div>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto custom-scrollbar">
                  {allGenres.map((genre) => (
                    <button
                      key={genre}
                      onClick={() => toggleGenre(genre)}
                      className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${selectedGenres.includes(genre)
                        ? "bg-purple-500/20 border-purple-500/50 text-purple-200"
                        : "bg-neutral-800/50 border-white/5 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
                        }`}
                    >
                      {genre}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Ratings</div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-neutral-400">
                      <span>Your rating</span>
                      <span>{userRatingValue !== null ? `${userRatingValue}+` : "Any"}</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      step={1}
                      value={userRatingValue ?? 1}
                      onChange={(event) => setUserRatingValue(Number(event.target.value))}
                      aria-label="Minimum user rating"
                      className="w-full"
                    />
                    <div className="flex justify-between text-[10px] text-neutral-600">
                      {Array.from({ length: 10 }, (_, index) => (
                        <span key={index + 1}>{index + 1}</span>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-neutral-400">
                      <span>IMDb rating</span>
                      <span>{imdbRatingValue !== null ? `${imdbRatingValue.toFixed(1)}+` : "Any"}</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      step={0.1}
                      value={imdbRatingValue ?? 1}
                      onChange={(event) => setImdbRatingValue(Number(event.target.value))}
                      aria-label="Minimum IMDb rating"
                      className="w-full"
                    />
                    <div className="flex justify-between text-[10px] text-neutral-600">
                      {Array.from({ length: 10 }, (_, index) => (
                        <span key={index + 1}>{index + 1}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
