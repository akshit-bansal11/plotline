"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { Filter, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ImageWithSkeleton } from "@/components/ui/ImageWithSkeleton";
import type { LoggableMedia } from "@/components/entry/LogEntryModal";
import {
  ANIME_STUDIO_OPTIONS,
  GAME_PLATFORM_OPTIONS,
  GLOBAL_SEARCH_SUBTYPE_OPTIONS,
  GLOBAL_SEARCH_TYPE_OPTIONS,
  MANGA_SERIALIZATION_OPTIONS,
  SEARCH_STATUS_OPTIONS,
  SHARED_GENRE_OPTIONS,
  getBaseTypeFromSearchType,
  getYearFilterOptions,
  normalizeSubtype,
  type ApiBaseType,
  type ApiSearchStatus,
  type ApiSearchType,
} from "@/lib/searchFilters";

type SearchResult = {
  id: string;
  title: string;
  image: string | null;
  year?: string;
  type: ApiBaseType;
  overview?: string;
  rating?: number | null;
  genres?: string[];
  subtype?: string | null;
  status?: ApiSearchStatus | null;
  episodeCount?: number | null;
  chapterCount?: number | null;
  studio?: string | null;
  platforms?: string[];
  serialization?: string | null;
};

interface SearchResponse {
  results: SearchResult[];
  errors?: string[];
}

type YearOption = ReturnType<typeof getYearFilterOptions>[number];

interface GlobalSearchProps {
  className?: string;
  onSelectMedia?: (media: LoggableMedia) => void;
  onRequireAuth?: () => void;
  disabled?: boolean;
}

const typeLabels: Record<ApiBaseType, string> = {
  movie: "Movie",
  series: "Series",
  anime: "Anime",
  manga: "Manga",
  game: "Game",
};

const statusLabels: Record<ApiSearchStatus, string> = {
  finished: "Finished",
  airing: "Airing",
  tba: "TBA",
  not_yet_aired: "Not Yet Aired",
};

const toDisplaySubtype = (value: string | null | undefined) => {
  if (!value) return null;
  if (value === "one_shot") return "One-shot";
  if (value === "light_novel") return "Light Novel";
  if (value === "short_movie") return "Short Movie";
  return value.replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
};

const getResultTypeLabel = (result: SearchResult) => {
  if (result.type === "anime" && result.subtype === "movie") return "Anime Movie";
  return typeLabels[result.type];
};

const discoveryQueryPool: Record<ApiBaseType | "all", string[]> = {
  movie: ["adventure", "drama", "thriller", "animation", "classic"],
  series: ["mystery", "comedy", "crime", "fantasy", "family"],
  anime: ["shounen", "romance", "isekai", "seinen", "slice of life"],
  manga: ["seinen", "shoujo", "mystery", "drama", "fantasy"],
  game: ["rpg", "action", "strategy", "adventure", "indie"],
  all: ["popular", "trending", "classic", "award", "top rated"],
};

const SUGGESTION_LOADER_MIN_MS = 180;

export function GlobalSearch({ className, onSelectMedia, onRequireAuth, disabled = false }: GlobalSearchProps) {
  const yearOptions = useMemo<YearOption[]>(() => getYearFilterOptions(), []);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [discoveryNonce, setDiscoveryNonce] = useState(0);
  const [selectedType, setSelectedType] = useState<ApiSearchType | null>(null);
  const [selectedSubtype, setSelectedSubtype] = useState<string | null>(null);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedYearId, setSelectedYearId] = useState("");
  const [ratingMin, setRatingMin] = useState<number | null>(null);
  const [minEpisodesOrChapters, setMinEpisodesOrChapters] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<ApiSearchStatus | null>(null);
  const [selectedStudio, setSelectedStudio] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [selectedSerialization, setSelectedSerialization] = useState<string | null>(null);
  const [pendingSelectionKey, setPendingSelectionKey] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const cacheRef = useRef<Map<string, SearchResponse>>(new Map());
  const abortRef = useRef<AbortController | null>(null);

  const baseType = getBaseTypeFromSearchType(selectedType);
  const subtypeOptions = selectedType ? GLOBAL_SEARCH_SUBTYPE_OPTIONS[selectedType] || [] : [];

  const showEpisodesFilter = selectedType === "series" || selectedType === "anime";
  const showChaptersFilter = selectedType === "manga";
  const showStudioFilter = selectedType === "anime" || selectedType === "anime_movie";
  const showPlatformFilter = selectedType === "game";
  const showSerializationFilter = selectedType === "manga";

  const yearRange = useMemo(() => yearOptions.find((option) => option.id === selectedYearId) || null, [selectedYearId, yearOptions]);

  const ratingMinDisplay = ratingMin !== null ? ratingMin.toFixed(1) : "Any";

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const container = containerRef.current;
      if (!container) return;

      if (!container.contains(target)) {
        setIsOpen(false);
        inputRef.current?.blur();
        return;
      }

      const targetEl = target as HTMLElement;
      const interactiveField = targetEl.closest("input, textarea, select, option");
      if (interactiveField) return;

      requestAnimationFrame(() => {
        inputRef.current?.focus({ preventScroll: true });
      });
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (selectedType === "anime_movie") {
      setSelectedSubtype("movie");
    } else {
      setSelectedSubtype((current) => {
        if (!current || !baseType) return null;
        return normalizeSubtype(baseType, current);
      });
    }

    if (!showStudioFilter) setSelectedStudio(null);
    if (!showPlatformFilter) setSelectedPlatform(null);
    if (!showSerializationFilter) setSelectedSerialization(null);
    if (!showEpisodesFilter && !showChaptersFilter) setMinEpisodesOrChapters("");
  }, [selectedType, baseType, showStudioFilter, showPlatformFilter, showSerializationFilter, showEpisodesFilter, showChaptersFilter]);

  const activeFilterCount =
    (selectedType ? 1 : 0) +
    (selectedSubtype && selectedType !== "anime_movie" ? 1 : 0) +
    selectedGenres.length +
    (yearRange ? 1 : 0) +
    (ratingMin !== null ? 1 : 0) +
    (minEpisodesOrChapters ? 1 : 0) +
    (selectedStatus ? 1 : 0) +
    (selectedStudio ? 1 : 0) +
    (selectedPlatform ? 1 : 0) +
    (selectedSerialization ? 1 : 0);

  const hasActiveFilters = activeFilterCount > 0;

  const discoveryQuery = useMemo(() => {
    const explicitTerms: string[] = [];
    if (selectedGenres.length > 0) explicitTerms.push(...selectedGenres);
    if (selectedStudio) explicitTerms.push(selectedStudio);
    if (selectedPlatform) explicitTerms.push(selectedPlatform);
    if (selectedSerialization) explicitTerms.push(selectedSerialization);
    if (selectedSubtype) explicitTerms.push(selectedSubtype.replace(/_/g, " "));
    if (selectedStatus) explicitTerms.push(statusLabels[selectedStatus]);

    const pool = baseType ? discoveryQueryPool[baseType] : discoveryQueryPool.all;
    const candidates = [...explicitTerms, ...pool];
    if (candidates.length === 0) return "";
    const index = (Math.floor(Math.random() * candidates.length) + discoveryNonce) % candidates.length;
    return candidates[index];
  }, [
    baseType,
    discoveryNonce,
    selectedGenres,
    selectedPlatform,
    selectedSerialization,
    selectedStatus,
    selectedStudio,
    selectedSubtype,
  ]);

  const minCountValue = useMemo(() => {
    const parsed = Number(minEpisodesOrChapters);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
  }, [minEpisodesOrChapters]);

  const requestParams = useMemo(() => {
    if (!isOpen) return null;
    const effectiveQuery = debouncedQuery.length > 0 ? debouncedQuery : discoveryQuery;
    if (!effectiveQuery) return null;

    const params = new URLSearchParams({ q: effectiveQuery });
    if (debouncedQuery.length === 0) params.set("discover", "1");

    if (selectedType) params.set("type", selectedType);
    if (selectedSubtype && selectedType !== "anime_movie") params.set("subtype", selectedSubtype);
    if (selectedGenres.length > 0) params.set("genres", selectedGenres.join(","));
    if (yearRange) {
      params.set("yearMin", String(yearRange.min));
      params.set("yearMax", String(yearRange.max));
    }
    if (ratingMin !== null) params.set("ratingMin", ratingMin.toFixed(1));
    if (showEpisodesFilter && minCountValue !== null) params.set("episodeMin", String(minCountValue));
    if (showChaptersFilter && minCountValue !== null) params.set("chapterMin", String(minCountValue));
    if (selectedStatus) params.set("status", selectedStatus);
    if (selectedStudio) params.set("studio", selectedStudio);
    if (selectedPlatform) params.set("platform", selectedPlatform);
    if (selectedSerialization) params.set("serialization", selectedSerialization);

    return params;
  }, [
    debouncedQuery,
    discoveryQuery,
    isOpen,
    minCountValue,
    ratingMin,
    selectedGenres,
    selectedPlatform,
    selectedSerialization,
    selectedStatus,
    selectedStudio,
    selectedSubtype,
    selectedType,
    showChaptersFilter,
    showEpisodesFilter,
    yearRange,
  ]);

  useEffect(() => {
    let cancelled = false;
    let loaderTimeout: ReturnType<typeof setTimeout> | null = null;

    const clearLoaderTimeout = () => {
      if (loaderTimeout !== null) {
        clearTimeout(loaderTimeout);
        loaderTimeout = null;
      }
    };

    const finishLoading = (startedAt: number) => {
      if (cancelled) return;
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, SUGGESTION_LOADER_MIN_MS - elapsed);
      if (remaining === 0) {
        setIsLoading(false);
        return;
      }
      loaderTimeout = setTimeout(() => {
        if (cancelled) return;
        setIsLoading(false);
      }, remaining);
    };

    if (!requestParams) {
      setResults([]);
      setErrors([]);
      setIsLoading(false);
      abortRef.current?.abort();
      return () => {
        cancelled = true;
        clearLoaderTimeout();
      };
    }

    const startedAt = Date.now();
    setIsLoading(true);

    const cacheKey = requestParams.toString();
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      setResults(cached.results || []);
      setErrors(cached.errors || []);
      finishLoading(startedAt);
      return () => {
        cancelled = true;
        clearLoaderTimeout();
      };
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const run = async () => {
      try {
        const res = await fetch(`/api/search?${requestParams.toString()}`, { signal: controller.signal });
        if (!res.ok) {
          throw new Error(res.status === 429 ? "Search is rate limited. Try again shortly." : "Search failed.");
        }

        const payload = (await res.json()) as SearchResponse;
        const normalized: SearchResponse = {
          results: payload.results || [],
          errors: payload.errors || [],
        };

        cacheRef.current.set(cacheKey, normalized);
        setResults(normalized.results);
        setErrors(normalized.errors || []);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        setResults([]);
        setErrors([error instanceof Error ? error.message : "Search failed."]);
      } finally {
        finishLoading(startedAt);
      }
    };

    void run();

    return () => {
      cancelled = true;
      controller.abort();
      clearLoaderTimeout();
    };
  }, [requestParams]);

  const clearFilters = () => {
    setSelectedType(null);
    setSelectedSubtype(null);
    setSelectedGenres([]);
    setSelectedYearId("");
    setRatingMin(null);
    setMinEpisodesOrChapters("");
    setSelectedStatus(null);
    setSelectedStudio(null);
    setSelectedPlatform(null);
    setSelectedSerialization(null);
    if (debouncedQuery.length === 0) {
      setDiscoveryNonce((current) => current + 1);
    }
  };

  const toggleGenre = (genre: string) => {
    setSelectedGenres((current) =>
      current.includes(genre) ? current.filter((item) => item !== genre) : [...current, genre]
    );
  };

  const handleTypeSelect = (type: ApiSearchType) => {
    setSelectedType((current) => (current === type ? null : type));
  };

  const buildFallbackMedia = (result: SearchResult): LoggableMedia => {
    const resolvedType = result.type === "anime" && result.subtype === "movie" ? "anime_movie" : result.type;

    return {
      id: result.id,
      title: result.title,
      image: result.image,
      year: result.year,
      releaseYear: result.year,
      type: resolvedType,
      isMovie: resolvedType === "anime_movie",
      description: result.overview || "",
      imdbRating: result.rating ?? null,
      rating: result.rating ?? null,
      episodeCount: result.episodeCount ?? null,
      chapterCount: result.chapterCount ?? null,
      genresThemes: result.genres || [],
    };
  };

  const fetchMetadata = async (result: SearchResult): Promise<LoggableMedia> => {
    const fallback = buildFallbackMedia(result);

    try {
      const params = new URLSearchParams({
        type: result.type,
        id: String(result.id),
        title: result.title,
      });
      if (result.year) params.set("year", result.year);

      const response = await fetch(`/api/metadata?${params.toString()}`);
      if (!response.ok) return fallback;

      const payload = (await response.json()) as {
        data?: {
          title?: string;
          description?: string;
          year?: string;
          image?: string | null;
          rating?: number | null;
          lengthMinutes?: number | null;
          episodeCount?: number | null;
          chapterCount?: number | null;
          genresThemes?: string[];
          type?: ApiBaseType;
        } | null;
      };

      const data = payload.data;
      if (!data) return fallback;

      const mergedType =
        result.type === "anime" && result.subtype === "movie" ? "anime_movie" : data.type || result.type;

      return {
        ...fallback,
        title: data.title || fallback.title,
        description: data.description || fallback.description,
        image: data.image ?? fallback.image,
        year: data.year ?? fallback.year,
        releaseYear: data.year ?? fallback.releaseYear,
        type: mergedType,
        isMovie: mergedType === "anime_movie",
        imdbRating: data.rating ?? fallback.imdbRating,
        rating: data.rating ?? fallback.rating,
        lengthMinutes: data.lengthMinutes ?? fallback.lengthMinutes ?? null,
        episodeCount: data.episodeCount ?? fallback.episodeCount ?? null,
        chapterCount: data.chapterCount ?? fallback.chapterCount ?? null,
        genresThemes: data.genresThemes ?? fallback.genresThemes,
      };
    } catch {
      return fallback;
    }
  };

  const handleResultSelect = async (result: SearchResult) => {
    if (disabled) {
      onRequireAuth?.();
      return;
    }
    if (!onSelectMedia) return;

    const key = `${result.type}-${result.id}`;
    if (pendingSelectionKey === key) return;

    setPendingSelectionKey(key);
    try {
      const enriched = await fetchMetadata(result);
      onSelectMedia(enriched);
      setQuery("");
      setResults([]);
      setIsOpen(false);
      inputRef.current?.blur();
    } finally {
      setPendingSelectionKey(null);
    }
  };

  const subtitleLabel = showEpisodesFilter ? "Episodes" : showChaptersFilter ? "Chapters" : "Count";
  const showSearchLoadingLabel = debouncedQuery.length > 0 || hasActiveFilters;
  const visibleErrors = useMemo(
    () => errors.filter((error) => !/fetch failed|failed to fetch/i.test(error)),
    [errors],
  );

  return (
    <div ref={containerRef} className={cn("relative z-50 transition-[width] duration-300 ease-out", className)}>
      <div className="relative flex items-center rounded-full border border-white/10 bg-neutral-900/50 transition-colors focus-within:border-white/20 focus-within:bg-neutral-900/70">
        <Search size={15} className="ml-3 text-neutral-500" suppressHydrationWarning />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
            if (query.trim().length === 0) {
              setDiscoveryNonce((current) => current + 1);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setIsOpen(false);
            }
          }}
          placeholder="Search Catalog"
          className="w-full min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setResults([]);
              setErrors([]);
              setDiscoveryNonce((current) => current + 1);
              setIsOpen(true);
            }}
            className="rounded-full p-1 text-neutral-500 transition-colors hover:bg-white/5 hover:text-neutral-200"
            aria-label="Clear"
          >
            <X size={14} suppressHydrationWarning />
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            if (query.trim().length === 0) {
              setDiscoveryNonce((current) => current + 1);
            }
            requestAnimationFrame(() => {
              inputRef.current?.focus({ preventScroll: true });
            });
          }}
          className={cn(
            "relative mr-1 rounded-full p-2 transition-colors",
            hasActiveFilters
              ? "bg-emerald-400/10 text-emerald-300"
              : "text-neutral-500 hover:bg-white/5 hover:text-neutral-200"
          )}
          aria-label="Toggle filters"
          aria-expanded={isOpen}
        >
          <Filter size={14} suppressHydrationWarning />
          {activeFilterCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white">
              {activeFilterCount}
            </span>
          ) : null}
        </button>
      </div>

      <AnimatePresence>
        {isOpen ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute left-0 top-[calc(100%+10px)] w-[min(94vw,620px)] overflow-hidden rounded-2xl border border-white/10 bg-neutral-950/95 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl"
          >
            <div className="grid max-h-[72vh] grid-cols-1 md:grid-cols-[minmax(0,1fr)_340px]">
              <div className="min-h-0 overflow-y-auto custom-scrollbar">
              {isLoading ? (
                <div className="flex items-center gap-3 p-5 text-sm text-neutral-400">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
                  {showSearchLoadingLabel ? <span>Searching...</span> : null}
                </div>
              ) : null}

              {!isLoading && visibleErrors.length > 0 ? (
                <div className="space-y-1 p-4">
                  {visibleErrors.map((error, index) => (
                    <div key={`${error}-${index}`} className="text-xs text-amber-300">
                      {error}
                    </div>
                  ))}
                </div>
              ) : null}

              {!isLoading && results.length > 0 ? (
                <div className="py-2">
                  <div className="px-4 pb-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                    {results.length} suggestion{results.length === 1 ? "" : "s"}
                  </div>
                  {results.map((result) => {
                    const key = `${result.type}-${result.id}`;
                    const selecting = pendingSelectionKey === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          void handleResultSelect(result);
                        }}
                        className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5"
                        disabled={selecting}
                      >
                        <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-md bg-neutral-800">
                          {result.image ? (
                            <ImageWithSkeleton src={result.image} alt={result.title} fill className="object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-neutral-600">
                              <Search size={14} />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-white">{result.title}</div>
                          <div className="mt-0.5 truncate text-xs text-neutral-500">
                            {result.year ? `${result.year} - ` : ""}
                            {getResultTypeLabel(result)}
                            {result.subtype && result.subtype !== "movie" ? ` - ${toDisplaySubtype(result.subtype)}` : ""}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-neutral-400">
                            {typeof result.rating === "number" ? <span>Rating {result.rating.toFixed(1)}</span> : null}
                            {result.status ? <span>{statusLabels[result.status]}</span> : null}
                            {typeof result.episodeCount === "number" ? <span>{result.episodeCount} eps</span> : null}
                            {typeof result.chapterCount === "number" ? <span>{result.chapterCount} ch</span> : null}
                          </div>
                        </div>
                        {selecting ? <div className="pt-1 text-[11px] text-neutral-500">Loading...</div> : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              </div>

              <div className="min-h-0 overflow-y-auto border-t border-white/10 md:border-t-0 md:border-l md:border-white/10 custom-scrollbar">
                <div className="flex items-center justify-between px-4 py-3">
                <div className="text-sm font-semibold text-white">Search Filters</div>
                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-xs font-semibold text-neutral-400 transition-colors hover:text-white"
                  >
                    Clear all
                  </button>
                ) : null}
              </div>

                <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Type</div>
                <div className="flex flex-wrap gap-2">
                  {GLOBAL_SEARCH_TYPE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleTypeSelect(option.value)}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                        selectedType === option.value
                          ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                          : "border-white/10 bg-neutral-900/60 text-neutral-400 hover:border-white/20 hover:text-neutral-200"
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {subtypeOptions.length > 0 && selectedType !== "anime_movie" ? (
                <div className="space-y-2 md:col-span-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Subtype</div>
                  <div className="flex flex-wrap gap-2">
                    {subtypeOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setSelectedSubtype((current) => (current === option.value ? null : option.value))}
                        className={cn(
                          "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                          selectedSubtype === option.value
                            ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-200"
                            : "border-white/10 bg-neutral-900/60 text-neutral-400 hover:border-white/20 hover:text-neutral-200"
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="space-y-2 md:col-span-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Genre</div>
                <div className="flex flex-wrap gap-2">
                  {SHARED_GENRE_OPTIONS.map((genre) => (
                    <button
                      key={genre}
                      type="button"
                      onClick={() => toggleGenre(genre)}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                        selectedGenres.includes(genre)
                          ? "border-violet-400/40 bg-violet-400/10 text-violet-200"
                          : "border-white/10 bg-neutral-900/60 text-neutral-400 hover:border-white/20 hover:text-neutral-200"
                      )}
                    >
                      {genre}
                    </button>
                  ))}
                </div>
              </div>

              <label className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Year of Release</div>
                <select
                  value={selectedYearId}
                  onChange={(event) => setSelectedYearId(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-neutral-900/60 px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:ring-1 focus:ring-white/20"
                >
                  <option value="">Any</option>
                  {yearOptions.map((option) => (
                    <option key={option.id} value={option.id} className="bg-neutral-900 text-neutral-200">
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  <span>Rating</span>
                  <span className="text-neutral-400">{ratingMinDisplay}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={0.1}
                  value={ratingMin ?? 0}
                  onChange={(event) => setRatingMin(Number(event.target.value))}
                  className="w-full"
                />
                <button
                  type="button"
                  onClick={() => setRatingMin(null)}
                  className="text-[11px] text-neutral-500 transition-colors hover:text-neutral-300"
                >
                  Reset rating filter
                </button>
              </div>

              {(showEpisodesFilter || showChaptersFilter) ? (
                <label className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500">{subtitleLabel} (min)</div>
                  <input
                    type="number"
                    min={1}
                    value={minEpisodesOrChapters}
                    onChange={(event) => setMinEpisodesOrChapters(event.target.value)}
                    placeholder="Optional"
                    className="w-full rounded-xl border border-white/10 bg-neutral-900/60 px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/20"
                  />
                </label>
              ) : null}

              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Status</div>
                <div className="flex flex-wrap gap-2">
                  {SEARCH_STATUS_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setSelectedStatus((current) => (current === option.value ? null : option.value))}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                        selectedStatus === option.value
                          ? "border-amber-400/40 bg-amber-400/10 text-amber-200"
                          : "border-white/10 bg-neutral-900/60 text-neutral-400 hover:border-white/20 hover:text-neutral-200"
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {showStudioFilter ? (
                <label className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Studio</div>
                  <select
                    value={selectedStudio || ""}
                    onChange={(event) => setSelectedStudio(event.target.value || null)}
                    className="w-full rounded-xl border border-white/10 bg-neutral-900/60 px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:ring-1 focus:ring-white/20"
                  >
                    <option value="">Any</option>
                    {ANIME_STUDIO_OPTIONS.map((studio) => (
                      <option key={studio} value={studio} className="bg-neutral-900 text-neutral-200">
                        {studio}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {showPlatformFilter ? (
                <div className="space-y-2 md:col-span-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Platform</div>
                  <div className="flex flex-wrap gap-2">
                    {GAME_PLATFORM_OPTIONS.map((platform) => (
                      <button
                        key={platform}
                        type="button"
                        onClick={() => setSelectedPlatform((current) => (current === platform ? null : platform))}
                        className={cn(
                          "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                          selectedPlatform === platform
                            ? "border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-200"
                            : "border-white/10 bg-neutral-900/60 text-neutral-400 hover:border-white/20 hover:text-neutral-200"
                        )}
                      >
                        {platform}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {showSerializationFilter ? (
                <div className="space-y-2 md:col-span-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Serialization</div>
                  <div className="flex flex-wrap gap-2">
                    {MANGA_SERIALIZATION_OPTIONS.map((serialization) => (
                      <button
                        key={serialization}
                        type="button"
                        onClick={() => setSelectedSerialization((current) => (current === serialization ? null : serialization))}
                        className={cn(
                          "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                          selectedSerialization === serialization
                            ? "border-sky-400/40 bg-sky-400/10 text-sky-200"
                            : "border-white/10 bg-neutral-900/60 text-neutral-400 hover:border-white/20 hover:text-neutral-200"
                        )}
                      >
                        {serialization}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
