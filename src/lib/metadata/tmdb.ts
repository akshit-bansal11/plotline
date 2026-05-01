// File: src/lib/metadata/tmdb.ts
// Purpose: TMDB API fetch functions for metadata enrichment

// ─── Internal — types
import type { EntryMediaType } from "@/types/log-entry";

/**
 * Metadata result interface used across providers
 */
export type MetadataResult = {
  title?: string;
  description?: string;
  year?: string;
  type?: EntryMediaType;
  image?: string | null;
  rating?: number | null;
  tmdbRating?: number | null;
  imdbRating?: number | null;
  lengthMinutes?: number | null;
  episodeCount?: number | null;
  chapterCount?: number | null;
  genresThemes?: string[];
  genreIds?: number[];
  cast?: string[];
  director?: string | null;
  producer?: string | null;
};

// ─── Internal — utils/lib
import { safeFetchJson } from "../safeFetch";

// ─── Constants & Helpers
const parseYear = (value?: string | null) => (value ? value.split("-")[0] : undefined);
const round1 = (value: number) => Math.round(value * 10) / 10;

// ─── TMDB Functions

/**
 * Search for a TMDB ID by title, media type, and optional year
 */
export const searchTmdbIdByTitle = async (
  title: string,
  mediaType: EntryMediaType,
  year?: string | null,
): Promise<string | null> => {
  const apiKey = process.env.TMDB_API_KEY;
  const bearerToken = process.env.TMDB_BEARER_TOKEN;
  if (!apiKey && !bearerToken) return null;
  if (mediaType !== "movie" && mediaType !== "series") return null;

  const tmdbType = mediaType === "series" ? "tv" : "movie";
  const yearParam = year?.trim()
    ? mediaType === "movie"
      ? `&year=${encodeURIComponent(year)}`
      : `&first_air_date_year=${encodeURIComponent(year)}`
    : "";
  
  const url = `https://api.themoviedb.org/3/search/${tmdbType}?query=${encodeURIComponent(title)}${yearParam}`;
  const headers = bearerToken ? { Authorization: `Bearer ${bearerToken}` } : undefined;
  const finalUrl = bearerToken ? url : `${url}&api_key=${apiKey}`;
  
  const response = await safeFetchJson<{ results?: Array<{ id?: number }> }>(finalUrl, { headers });
  if (!response.ok) return null;
  
  const payload = response.data;
  const match = payload.results?.[0];
  return match?.id ? String(match.id) : null;
};

/**
 * Fetch credits (cast and director) for a TMDB entry
 */
export const fetchTmdbCredits = async (
  id: string,
  mediaType: EntryMediaType,
): Promise<{ cast: string[]; director: string | null }> => {
  const apiKey = process.env.TMDB_API_KEY;
  const bearerToken = process.env.TMDB_BEARER_TOKEN;
  if (!apiKey && !bearerToken) return { cast: [], director: null };
  if (mediaType !== "movie" && mediaType !== "series") return { cast: [], director: null };

  const tmdbType = mediaType === "series" ? "tv" : "movie";
  const url = `https://api.themoviedb.org/3/${tmdbType}/${encodeURIComponent(id)}/credits?language=en-US`;
  const headers = bearerToken ? { Authorization: `Bearer ${bearerToken}` } : undefined;
  const finalUrl = bearerToken ? url : `${url}&api_key=${apiKey}`;
  
  const response = await safeFetchJson<{
    cast?: Array<{ name?: string }>;
    crew?: Array<{ name?: string; job?: string }>;
  }>(finalUrl, { headers });
  
  if (!response.ok) return { cast: [], director: null };

  const data = response.data;
  const cast = Array.isArray(data.cast)
    ? data.cast
        .slice(0, 5)
        .map((c) => c.name)
        .filter((v): v is string => Boolean(v))
    : [];

  let director = null;
  if (Array.isArray(data.crew)) {
    const d = data.crew.find((c) => c.job === "Director");
    if (d?.name) director = d.name;
    else if (mediaType === "series") {
      const creator = data.crew.find((c) => c.job === "Executive Producer");
      if (creator?.name) director = creator.name;
    }
  }

  return { cast, director };
};

/**
 * Fetch full metadata for a TMDB entry by its ID
 */
export const fetchTmdbMetadataById = async (
  id: string,
  mediaType: EntryMediaType,
): Promise<MetadataResult | null> => {
  const apiKey = process.env.TMDB_API_KEY;
  const bearerToken = process.env.TMDB_BEARER_TOKEN;
  if (!apiKey && !bearerToken) return null;
  if (mediaType !== "movie" && mediaType !== "series") return null;

  const tmdbType = mediaType === "series" ? "tv" : "movie";
  const url = `https://api.themoviedb.org/3/${tmdbType}/${encodeURIComponent(id)}?language=en-US`;
  const headers = bearerToken ? { Authorization: `Bearer ${bearerToken}` } : undefined;
  const finalUrl = bearerToken ? url : `${url}&api_key=${apiKey}`;
  
  const [detailsRes, credits] = await Promise.all([
    safeFetchJson<{
      title?: string;
      name?: string;
      overview?: string;
      release_date?: string;
      first_air_date?: string;
      runtime?: number;
      episode_run_time?: number[];
      number_of_episodes?: number;
      poster_path?: string | null;
      vote_average?: number;
      genres?: Array<{ id?: number; name?: string }>;
      production_companies?: Array<{ name?: string }>;
    }>(finalUrl, { headers }),
    fetchTmdbCredits(id, mediaType),
  ]);

  if (!detailsRes.ok) return null;
  const data = detailsRes.data;

  const lengthMinutes =
    mediaType === "movie"
      ? typeof data.runtime === "number"
        ? data.runtime
        : null
      : Array.isArray(data.episode_run_time) && data.episode_run_time.length > 0
        ? (data.episode_run_time[0] ?? null)
        : null;

  return {
    title: data.title || data.name,
    description: data.overview || "",
    year: parseYear(mediaType === "movie" ? data.release_date : data.first_air_date),
    type: mediaType,
    image: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : null,
    rating: typeof data.vote_average === "number" ? round1(data.vote_average) : null,
    tmdbRating: typeof data.vote_average === "number" ? round1(data.vote_average) : null,
    lengthMinutes,
    episodeCount:
      mediaType === "series" && typeof data.number_of_episodes === "number"
        ? data.number_of_episodes
        : null,
    genresThemes: Array.isArray(data.genres)
      ? data.genres.map((g) => g.name).filter((v): v is string => Boolean(v))
      : [],
    genreIds: Array.isArray(data.genres)
      ? data.genres
          .map((g) => g.id)
          .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
      : [],
    cast: credits.cast,
    director: credits.director,
    producer: Array.isArray(data.production_companies) ? data.production_companies[0]?.name : null,
  };
};

/**
 * Fetch TMDB metadata by ID or by searching title
 */
export const fetchTmdbMetadata = async (
  id: string | null,
  title: string | null,
  mediaType: EntryMediaType,
  year?: string | null,
): Promise<MetadataResult | null> => {
  if (mediaType !== "movie" && mediaType !== "series") return null;
  const resolvedId =
    id && /^\d+$/.test(id) ? id : title ? await searchTmdbIdByTitle(title, mediaType, year) : null;
  if (!resolvedId) return null;
  return fetchTmdbMetadataById(resolvedId, mediaType);
};
