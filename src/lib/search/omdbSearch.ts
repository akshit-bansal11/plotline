// File: src/lib/search/omdbSearch.ts
// Purpose: OMDB search functions for the /api/search route

// ─── Internal — types
import type { ApiBaseType } from "@/utils/searchFilters";
import type { SearchResult } from "./tmdbSearch";

export interface OmdbResult {
  imdbID: string;
  Title: string;
  Poster: string;
  Year: string;
  Type: string;
}

export interface OmdbDetail {
  Genre?: string;
  imdbRating?: string;
  Runtime?: string;
}

import { normalizeGenreName } from "@/utils/searchFilters";
// ─── Internal — utils/lib
import { safeFetchJson } from "../safeFetch";

// ─── Constants & Helpers
const normalizeGenres = (genres: Array<string | null | undefined>) => {
  const set = new Set<string>();
  genres.forEach((genre) => {
    const normalized = normalizeGenreName(genre);
    if (normalized) set.add(normalized);
  });
  return Array.from(set);
};

const parseRuntimeMinutes = (value?: string | null) => {
  if (!value) return null;
  const match = value.match(/(\d+)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
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

// ─── OMDB Functions

/**
 * Fetch detailed OMDB data for a specific entry
 */
export const fetchOmdbDetails = async (
  imdbID: string,
  apiKey: string,
): Promise<OmdbDetail | null> => {
  const response = await safeFetchJson<OmdbDetail & { Response?: string }>(
    `https://www.omdbapi.com/?apikey=${apiKey}&i=${encodeURIComponent(imdbID)}&plot=short`,
  );
  if (!response.ok) return null;
  const payload = response.data;
  if (payload.Response === "False") return null;
  return payload;
};

/**
 * Search OMDB for movies and series
 */
export const searchOMDB = async (
  queryValue: string,
  type?: "movie" | "series",
): Promise<{ results: SearchResult[]; error: string }> => {
  const apiKey = process.env.OMDB_API_KEY;
  if (!apiKey) {
    return { results: [], error: "Movie/series data provider is not configured." };
  }

  const typeParam = type ? `&type=${type}` : "";
  const url = `https://www.omdbapi.com/?apikey=${apiKey}&s=${encodeURIComponent(queryValue)}${typeParam}`;

  const response = await safeFetchJson<{ Response?: string; Search?: OmdbResult[] }>(url);
  if (!response.ok) return { results: [], error: response.error };

  const payload = response.data;
  if (payload.Response === "False") return { results: [], error: "" };

  const rawResults = (payload.Search || [])
    .filter((item) => item.Type === "movie" || item.Type === "series")
    .slice(0, 12);

  const details = await Promise.all(
    rawResults.map((item) => fetchOmdbDetails(item.imdbID, apiKey)),
  );

  const results: SearchResult[] = rawResults.map((item, index) => {
    const resultType: ApiBaseType = item.Type === "series" ? "series" : "movie";
    const detail = details[index];
    const rating =
      detail?.imdbRating && detail.imdbRating !== "N/A" ? Number(detail.imdbRating) : null;
    const lengthMinutes = parseRuntimeMinutes(detail?.Runtime || null);
    const genres = normalizeGenres((detail?.Genre || "").split(",").map((part) => part.trim()));

    const base: SearchResult = {
      id: item.imdbID,
      title: item.Title,
      image: item.Poster !== "N/A" ? item.Poster : null,
      year: item.Year,
      type: resultType,
      overview: "",
      rating: typeof rating === "number" && Number.isFinite(rating) ? rating : null,
      genres,
      lengthMinutes,
    };

    return {
      ...base,
      subtype: resolveSubtype(resultType, null, lengthMinutes),
    };
  });

  return { results, error: "" };
};
