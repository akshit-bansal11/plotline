// File: src/lib/search/tmdbSearch.ts
// Purpose: TMDB search functions for the /api/search route

// ─── Internal — types
import type { ApiBaseType } from "@/utils/searchFilters";

/**
 * Common search result interface shared across providers
 */
export interface SearchResult {
  id: string;
  title: string;
  image: string | null;
  year?: string;
  type: ApiBaseType;
  overview?: string;
  rating?: number | null;
  genres?: string[];
  subtype?: string | null;
  status?: string | null;
  episodeCount?: number | null;
  chapterCount?: number | null;
  studio?: string | null;
  platforms?: string[];
  serialization?: string | null;
  lengthMinutes?: number | null;
}

export interface TmdbResult {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  media_type?: string;
  overview?: string;
  vote_average?: number;
  genre_ids?: number[];
}

export interface TmdbDetail {
  status?: string;
  runtime?: number;
  episode_run_time?: number[];
  number_of_episodes?: number;
  genres?: Array<{ id?: number; name?: string }>;
}

import { normalizeGenreName, normalizeStatusName } from "@/utils/searchFilters";
// ─── Internal — utils/lib
import { safeFetchJson } from "../safeFetch";

// ─── Constants
const TMDB_MOVIE_GENRE_MAP: Record<number, string> = {
  28: "Action",
  12: "Adventure",
  35: "Comedy",
  18: "Drama",
  14: "Fantasy",
  27: "Horror",
  9648: "Mystery",
  10749: "Romance",
  878: "Sci-Fi",
  53: "Thriller",
};

const TMDB_TV_GENRE_MAP: Record<number, string> = {
  10759: "Action",
  16: "Adventure",
  35: "Comedy",
  18: "Drama",
  10765: "Sci-Fi",
  9648: "Mystery",
  10768: "Thriller",
};

// ─── Helpers
const normalizeGenres = (genres: Array<string | null | undefined>) => {
  const set = new Set<string>();
  genres.forEach((genre) => {
    const normalized = normalizeGenreName(genre);
    if (normalized) set.add(normalized);
  });
  return Array.from(set);
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

const buildTmdbUrl = (path: string) => {
  const apiKey = process.env.TMDB_API_KEY;
  const bearerToken = process.env.TMDB_BEARER_TOKEN;
  if (!apiKey && !bearerToken) return { url: null, headers: undefined };

  const headers = bearerToken ? { Authorization: `Bearer ${bearerToken}` } : undefined;
  if (bearerToken) return { url: `https://api.themoviedb.org/3${path}`, headers };

  const separator = path.includes("?") ? "&" : "?";
  return { url: `https://api.themoviedb.org/3${path}${separator}api_key=${apiKey}`, headers };
};

const mapTmdbGenreIds = (ids: number[] | undefined, type: "movie" | "tv") => {
  if (!ids || ids.length === 0) return [];
  const map = type === "tv" ? TMDB_TV_GENRE_MAP : TMDB_MOVIE_GENRE_MAP;
  return normalizeGenres(ids.map((id) => map[id] || null));
};

// ─── TMDB Functions

/**
 * Fetch extra details for a TMDB entry to enrich search results
 */
export const fetchTmdbDetails = async (id: number, type: "movie" | "tv") => {
  const endpoint = buildTmdbUrl(`/${type}/${id}?language=en-US`);
  if (!endpoint.url) return null;

  const response = await safeFetchJson<TmdbDetail>(endpoint.url, { headers: endpoint.headers });
  if (!response.ok) return null;

  const payload = response.data;
  const genres = normalizeGenres(
    (payload.genres || []).map((g) => g.name).filter((g): g is string => Boolean(g)),
  );

  const runtime = typeof payload.runtime === "number" ? payload.runtime : null;
  const episodeRuntime =
    Array.isArray(payload.episode_run_time) && payload.episode_run_time.length > 0
      ? payload.episode_run_time[0] || null
      : null;

  return {
    status: normalizeStatusName(payload.status),
    episodeCount:
      typeof payload.number_of_episodes === "number" ? payload.number_of_episodes : null,
    lengthMinutes: type === "movie" ? runtime : episodeRuntime,
    genres,
  };
};

/**
 * Search TMDB for movies and series
 */
export const searchTMDB = async (
  queryValue: string,
): Promise<{ results: SearchResult[]; error: string }> => {
  const endpoint = buildTmdbUrl(
    `/search/multi?query=${encodeURIComponent(queryValue)}&include_adult=false`,
  );
  if (!endpoint.url) {
    return { results: [], error: "Movie/series data provider is not configured." };
  }

  const response = await safeFetchJson<{ results?: TmdbResult[] }>(endpoint.url, {
    headers: endpoint.headers,
  });
  if (!response.ok) return { results: [], error: response.error };

  const payload = response.data;
  const rawResults = (payload.results || [])
    .filter((item) => item.media_type === "movie" || item.media_type === "tv")
    .slice(0, 12);

  const detailPayloads = await Promise.all(
    rawResults.map((item) => fetchTmdbDetails(item.id, item.media_type === "tv" ? "tv" : "movie")),
  );

  const results: SearchResult[] = rawResults.map((item, index) => {
    const type: ApiBaseType = item.media_type === "tv" ? "series" : "movie";
    const detail = detailPayloads[index];
    const baseGenres = mapTmdbGenreIds(item.genre_ids, item.media_type === "tv" ? "tv" : "movie");
    const mergedGenres = Array.from(new Set([...baseGenres, ...(detail?.genres || [])]));

    const base: SearchResult = {
      id: String(item.id),
      title: item.title || item.name || "",
      image: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
      year: (item.release_date || item.first_air_date || "").split("-")[0],
      type,
      overview: item.overview || "",
      rating: item.vote_average ?? null,
      genres: mergedGenres,
      status: detail?.status ?? null,
      episodeCount: detail?.episodeCount ?? null,
      lengthMinutes: detail?.lengthMinutes ?? null,
    };

    return {
      ...base,
      subtype: resolveSubtype(type, null, base.lengthMinutes ?? null),
    };
  });

  return { results, error: "" };
};
