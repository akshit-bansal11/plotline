"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Search, Filter, X } from "lucide-react";
import Image from "next/image";
import { useData, EntryDoc, EntryMediaType, EntryStatus } from "@/context/data-context";
import { AnimatePresence, motion } from "motion/react";

const mediaTypeLabels: Record<EntryMediaType, string> = {
  movie: "Movie",
  series: "Series",
  anime: "Anime",
  // anime_movie: "Anime Movie",
  manga: "Manga",
  game: "Game",
};

const statusLabels: Record<EntryStatus, string> = {
  watching: "Watching",
  completed: "Completed",
  plan_to_watch: "Plan to Watch",
  on_hold: "On hold",
  dropped: "Dropped",
  unspecified: "Unspecified",
  main_story_completed: "Main Story Completed",
  fully_completed: "Fully Completed",
  backlogged: "Backlogged",
  bored: "Bored",
  own: "Own",
  wishlist: "Wishlist",
  not_committed: "Not Committed",
  committed: "Committed",
};

export function GlobalSearch() {
  const { entries, setSelectedEntry } = useData();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowFilters(false);
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
      .slice(0, 10); // Limit results
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
    setIsOpen(false);
    setQuery("");
  };

  return (
    <div ref={containerRef} className="relative z-50">
      <div className="relative flex items-center">
        <div className="relative flex items-center bg-white/5 rounded-full border border-white/5 focus-within:bg-white/10 focus-within:border-white/20 transition-all overflow-hidden w-64 focus-within:w-80 transition-width duration-300">
          <Search size={16} className="text-neutral-400 ml-3 shrink-0" suppressHydrationWarning />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
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
          <button
            onClick={() => {
              setShowFilters(!showFilters);
              setIsOpen(true);
            }}
            className={`p-2 mr-1 rounded-full transition-colors ${showFilters || hasActiveFilters ? 'text-blue-400 bg-blue-400/10' : 'text-neutral-400 hover:text-white hover:bg-white/10'}`}
          >
            <Filter size={14} suppressHydrationWarning />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (query || showFilters) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute top-full right-0 mt-2 w-[400px] bg-neutral-950/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
          >
            {showFilters && (
              <div className="p-4 border-b border-white/5 bg-neutral-900/30">
                <div className="space-y-4">
                  <div>
                    <div className="text-xs font-semibold text-neutral-500 mb-2 uppercase tracking-wider">Type</div>
                    <div className="flex flex-wrap gap-2">
                      {(Object.keys(mediaTypeLabels) as EntryMediaType[]).map(type => (
                        <button
                          key={type}
                          onClick={() => toggleType(type)}
                          className={`px-2 py-1 rounded-md text-xs border transition-colors ${selectedTypes.includes(type)
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
                          className={`px-2 py-1 rounded-md text-xs border transition-colors ${selectedStatus.includes(status)
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
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto custom-scrollbar">
                      {allGenres.map((genre) => (
                        <button
                          key={genre}
                          onClick={() => toggleGenre(genre)}
                          className={`px-2 py-1 rounded-md text-xs border transition-colors ${selectedGenres.includes(genre)
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
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-neutral-400">
                          <span>Your rating</span>
                          <span>{userRatingValue !== null ? `${userRatingValue}+` : "Any"}</span>
                        </div>
                        <div className="space-y-2">
                          <input
                            type="range"
                            min={1}
                            max={10}
                            step={1}
                            value={userRatingValue ?? 1}
                            onChange={(event) => {
                              const next = Number(event.target.value);
                              setUserRatingValue(next);
                            }}
                            aria-label="Minimum user rating"
                            className="w-full"
                            list="user-rating-ticks"
                          />
                          <div className="flex justify-between text-[10px] text-neutral-500">
                            {Array.from({ length: 10 }, (_, index) => (
                              <span key={index + 1}>{index + 1}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-neutral-400">
                          <span>IMDb rating</span>
                          <span>{imdbRatingValue !== null ? `${imdbRatingValue.toFixed(1)}+` : "Any"}</span>
                        </div>
                        <div className="space-y-2">
                          <input
                            type="range"
                            min={1}
                            max={10}
                            step={0.1}
                            value={imdbRatingValue ?? 1}
                            onChange={(event) => {
                              const next = Number(event.target.value);
                              setImdbRatingValue(next);
                            }}
                            aria-label="Minimum IMDb rating"
                            className="w-full"
                            list="imdb-rating-ticks"
                          />
                          <div className="flex justify-between text-[10px] text-neutral-500">
                            {Array.from({ length: 10 }, (_, index) => (
                              <span key={index + 1}>{index + 1}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
              {filteredEntries.length > 0 ? (
                <div className="py-2">
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
                  {query ? "No results found." : "Type to search..."}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
