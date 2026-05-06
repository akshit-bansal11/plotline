// File: src/lib/search/mergeResults.ts
// Purpose: Search result merging, deduplication, filtering, and sanitization

// ─── Internal — types
import type { ApiBaseType, ApiSearchStatus, ApiSearchType } from "@/utils/searchFilters";
import type { SearchResult } from "./tmdbSearch";

/**
 * Filter configuration for search requests
 */
export interface SearchFilters {
  searchType: ApiSearchType | null;
  baseType: ApiBaseType | null;
  subtype: string | null;
  genres: Set<string>;
  yearMin: number | null;
  yearMax: number | null;
  ratingMin: number | null;
  episodeMin: number | null;
  chapterMin: number | null;
  status: ApiSearchStatus | null;
  studio: string | null;
  platform: string | null;
  serialization: string | null;
}

// ─── Internal — utils/lib
import {
  normalizeGamePlatform,
  normalizeSerializationName,
  normalizeStudioName,
} from "@/utils/searchFilters";

// ─── Constants & Helpers
const normalizeTitle = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();
const normalizeYearKey = (value?: string) => (value ? value.trim() : "");

const parseYearNumber = (value?: string | null) => {
  if (!value) return null;
  const match = value.match(/\d{4}/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
};

const resolveSubtype = (
  type: ApiBaseType,
  subtype: string | null,
  lengthMinutes: number | null,
) => {
  if (type === "movie") {
    if (subtype) return subtype;
    if (typeof lengthMinutes === "number" && lengthMinutes > 0 && lengthMinutes <= 45)
      return "short_movie";
  }
  return subtype;
};

// ─── Merging Logic

/**
 * Merge two search results for the same media item, combining fields and preferring longer overviews
 */
export const mergeSearchResult = (primary: SearchResult, secondary: SearchResult): SearchResult => {
  const primaryOverview = primary.overview || "";
  const secondaryOverview = secondary.overview || "";

  const mergedGenres = Array.from(
    new Set([...(primary.genres || []), ...(secondary.genres || [])]),
  );
  const mergedPlatforms = Array.from(
    new Set([...(primary.platforms || []), ...(secondary.platforms || [])]),
  );
  const mergedLength = primary.lengthMinutes ?? secondary.lengthMinutes ?? null;

  return {
    ...primary,
    title: primary.title || secondary.title,
    image: primary.image ?? secondary.image,
    year: primary.year || secondary.year,
    overview:
      primaryOverview.length >= secondaryOverview.length ? primaryOverview : secondaryOverview,
    rating: primary.rating ?? secondary.rating ?? null,
    genres: mergedGenres,
    subtype: resolveSubtype(
      primary.type,
      primary.subtype ?? secondary.subtype ?? null,
      mergedLength,
    ),
    status: primary.status ?? secondary.status ?? null,
    episodeCount: primary.episodeCount ?? secondary.episodeCount ?? null,
    chapterCount: primary.chapterCount ?? secondary.chapterCount ?? null,
    studio: primary.studio ?? secondary.studio ?? null,
    platforms: mergedPlatforms,
    serialization: primary.serialization ?? secondary.serialization ?? null,
    lengthMinutes: mergedLength,
  };
};

/**
 * Merge multiple search result arrays, deduplicating by type, year, and title
 */
export const mergeMovieSeriesResults = (primary: SearchResult[], secondary: SearchResult[]) => {
  const seen = new Map<string, SearchResult>();

  for (const item of primary) {
    const key = `${item.type}|${normalizeYearKey(item.year)}|${normalizeTitle(item.title)}`;
    seen.set(key, item);
  }

  for (const item of secondary) {
    const key = `${item.type}|${normalizeYearKey(item.year)}|${normalizeTitle(item.title)}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, item);
      continue;
    }
    seen.set(key, mergeSearchResult(existing, item));
  }

  return Array.from(seen.values());
};

// ─── Filtering & Sanitization

/**
 * Check if a single search result matches the provided filters
 */
export const itemMatchesFilters = (item: SearchResult, filters: SearchFilters): boolean => {
  if (filters.searchType) {
    if (filters.searchType === "anime_movie") {
      if (!(item.type === "anime" && item.subtype === "movie")) return false;
    } else if (item.type !== filters.searchType) {
      return false;
    }
  }

  if (filters.subtype && item.subtype !== filters.subtype) return false;

  if (filters.genres.size > 0) {
    const itemGenres = new Set(item.genres || []);
    const hasAny = Array.from(filters.genres).some((genre) => itemGenres.has(genre));
    if (!hasAny) return false;
  }

  const year = parseYearNumber(item.year);
  if (typeof filters.yearMin === "number" && (!year || year < filters.yearMin)) return false;
  if (typeof filters.yearMax === "number" && (!year || year > filters.yearMax)) return false;

  if (typeof filters.ratingMin === "number") {
    if (typeof item.rating !== "number" || item.rating < filters.ratingMin) return false;
  }

  if (typeof filters.episodeMin === "number") {
    if (typeof item.episodeCount !== "number" || item.episodeCount < filters.episodeMin)
      return false;
  }

  if (typeof filters.chapterMin === "number") {
    if (typeof item.chapterCount !== "number" || item.chapterCount < filters.chapterMin)
      return false;
  }

  if (filters.status && item.status !== filters.status) return false;

  if (filters.studio) {
    if (!item.studio || normalizeStudioName(item.studio) !== filters.studio) return false;
  }

  if (filters.platform) {
    if (!item.platforms?.some((p) => normalizeGamePlatform(p) === filters.platform)) return false;
  }

  if (filters.serialization) {
    if (
      !item.serialization ||
      normalizeSerializationName(item.serialization) !== filters.serialization
    )
      return false;
  }

  return true;
};

/**
 * Apply filters to a list of search results
 */
export const applyFilters = (results: SearchResult[], filters: SearchFilters): SearchResult[] => {
  const hasActiveFilters =
    filters.searchType ||
    filters.subtype ||
    filters.genres.size > 0 ||
    filters.yearMin !== null ||
    filters.yearMax !== null ||
    filters.ratingMin !== null ||
    filters.episodeMin !== null ||
    filters.chapterMin !== null ||
    filters.status ||
    filters.studio ||
    filters.platform ||
    filters.serialization;

  if (!hasActiveFilters) return results;

  return results.filter((item) => itemMatchesFilters(item, filters));
};

/**
 * Sanitize and normalize fields of a search result
 */
export const sanitizeResult = (item: SearchResult): SearchResult => {
  const genres = Array.from(new Set(item.genres || []));
  const platforms = Array.from(new Set(item.platforms || []));
  const normalizedStudio = normalizeStudioName(item.studio || null);

  return {
    ...item,
    genres,
    platforms,
    studio: normalizedStudio || item.studio || null,
    serialization:
      normalizeSerializationName(item.serialization || null) || item.serialization || null,
    status: item.status || null,
    subtype: resolveSubtype(item.type, item.subtype || null, item.lengthMinutes ?? null),
  };
};
