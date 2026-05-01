// File: src/hooks/useSearchHandlers.ts
// Purpose: Orchestrates global search state, debouncing, and API interaction

"use client";

// ─── React
import { useCallback, useEffect, useRef, useState } from "react";

// ─── Internal — utils/search
import {
  type ApiBaseType,
  type ApiSearchStatus,
  type ApiSearchType,
} from "@/utils/searchFilters";

// ─── Internal — types
import type { LoggableMedia } from "@/types/log-entry";

// ─── Types
export type SearchResult = {
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

export interface SearchResponse {
  results: SearchResult[];
  errors?: string[];
}

export interface SearchFilters {
  type: ApiSearchType | null;
  status: ApiSearchStatus | null;
  genres: string[];
  yearMin: number | null;
  yearMax: number | null;
  platform: string | null;
  studio: string | null;
}

const DEFAULT_FILTERS: SearchFilters = {
  type: null,
  status: null,
  genres: [],
  yearMin: null,
  yearMax: null,
  platform: null,
  studio: null,
};

/**
 * Hook to manage global search state and operations.
 */
export function useSearchHandlers() {
  // ─── Search State
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // ─── Filter State
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);

  const cacheRef = useRef<Map<string, SearchResponse>>(new Map());
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // ─── Effect: Debounce Query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // ─── Logic: Search Execution
  useEffect(() => {
    if (!isOpen || (!debouncedQuery && !filters.type)) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    const performSearch = async () => {
      setIsLoading(true);
      const params = new URLSearchParams({ q: debouncedQuery });
      if (filters.type) params.set("type", filters.type);
      if (filters.status) params.set("status", filters.status);
      if (filters.genres.length > 0) params.set("genres", filters.genres.join(","));
      if (filters.yearMin) params.set("yearMin", String(filters.yearMin));

      const cacheKey = params.toString();
      if (cacheRef.current.has(cacheKey)) {
        const cached = cacheRef.current.get(cacheKey)!;
        setResults(cached.results);
        setIsLoading(false);
        return;
      }

      abortRef.current?.abort();
      abortRef.current = new AbortController();

      try {
        const res = await fetch(`/api/search?${params.toString()}`, {
          signal: abortRef.current.signal,
        });
        const data = await res.json();
        cacheRef.current.set(cacheKey, data);
        setResults(data.results || []);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Search failed:", err);
        }
      } finally {
        setIsLoading(false);
      }
    };

    performSearch();
  }, [debouncedQuery, filters, isOpen]);

  // ─── Callbacks: UI Actions
  const resetFilters = useCallback(() => setFilters(DEFAULT_FILTERS), []);
  const clearQuery = useCallback(() => setQuery(""), []);
  const toggleFilter = useCallback(() => setIsFilterOpen((prev) => !prev), []);
  const closeSearch = useCallback(() => {
    setIsOpen(false);
    setIsFilterOpen(false);
  }, []);

  const focusInput = useCallback(() => {
    setIsOpen(true);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  }, []);

  /**
   * Fetches full metadata for a result and emits it.
   */
  const selectMedia = useCallback(
    async (result: SearchResult, onSelect: (media: LoggableMedia) => void) => {
      try {
        const res = await fetch(
          `/api/metadata?type=${result.type}&id=${result.id}&title=${encodeURIComponent(result.title)}`,
        );
        const payload = await res.json();
        if (payload.data) {
          onSelect(payload.data);
        } else {
          // Fallback to basic data
          onSelect({
            id: result.id,
            title: result.title,
            type: result.type,
            image: result.image,
            year: result.year,
          } as any);
        }
        setIsOpen(false);
        setQuery("");
      } catch (err) {
        console.error("Metadata fetch failed:", err);
      }
    },
    [],
  );

  return {
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
  };
}
