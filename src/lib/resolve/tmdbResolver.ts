// File: src/lib/resolve/tmdbResolver.ts
// Purpose: TMDB URL to media metadata resolver

import type { ResolvedMedia, ResolvedMediaType } from "@/lib/resolve/types";
// ─── Internal — utils/lib
import { safeFetchJson } from "@/lib/safeFetch";
// ─── Internal — types
import type { ParsedMediaUrl } from "@/utils/parseMediaUrl";

// ─── Constants & Helpers
const parseYear = (value?: string | null) => (value ? value.split("-")[0] : undefined);
const round1 = (value: number) => Math.round(value * 10) / 10;

// ─── Resolver Functions

/**
 * Resolve metadata from a TMDB ID and media type
 */
export const resolveTmdb = async (parsed: ParsedMediaUrl): Promise<ResolvedMedia | null> => {
  if (!parsed.id || !parsed.mediaType) return null;
  const bearerToken = process.env.TMDB_BEARER_TOKEN;
  const apiKey = process.env.TMDB_API_KEY;
  if (!bearerToken && !apiKey) return null;

  const tmdbType = parsed.mediaType === "series" ? "tv" : "movie";
  const baseUrl = `https://api.themoviedb.org/3/${tmdbType}/${parsed.id}?language=en-US`;
  const url = bearerToken ? baseUrl : `${baseUrl}&api_key=${apiKey}`;
  const headers = bearerToken ? { Authorization: `Bearer ${bearerToken}` } : undefined;

  const response = await safeFetchJson<{
    title?: string;
    name?: string;
    overview?: string;
    release_date?: string;
    first_air_date?: string;
    runtime?: number;
    number_of_episodes?: number;
    poster_path?: string | null;
    vote_average?: number;
    genres?: Array<{ name?: string }>;
    imdb_id?: string;
  }>(url, { headers });

  if (!response.ok) return null;
  const data = response.data;
  const genres = Array.isArray(data.genres)
    ? data.genres.map((g) => g.name).filter((v): v is string => Boolean(v))
    : [];

  let imdbRating: number | null = null;
  if (data.imdb_id) {
    const omdbApiKey = process.env.OMDB_API_KEY;
    if (omdbApiKey) {
      const omdbRes = await safeFetchJson<{ imdbRating?: string; Response?: string }>(
        `https://www.omdbapi.com/?apikey=${omdbApiKey}&i=${data.imdb_id}&plot=short`,
      );
      if (
        omdbRes.ok &&
        omdbRes.data.Response !== "False" &&
        omdbRes.data.imdbRating &&
        omdbRes.data.imdbRating !== "N/A"
      ) {
        imdbRating = round1(Number(omdbRes.data.imdbRating));
        if (!Number.isFinite(imdbRating)) imdbRating = null;
      }
    }
  }

  return {
    id: parsed.id,
    title: data.title || data.name || "",
    image: data.poster_path ? `https://image.tmdb.org/p/w500${data.poster_path}` : null,
    year: parseYear(parsed.mediaType === "movie" ? data.release_date : data.first_air_date),
    type: parsed.mediaType as ResolvedMediaType,
    description: data.overview || undefined,
    rating: typeof data.vote_average === "number" ? round1(data.vote_average) : null,
    imdbRating,
    lengthMinutes:
      parsed.mediaType === "movie" && typeof data.runtime === "number" ? data.runtime : null,
    episodeCount:
      parsed.mediaType === "series" && typeof data.number_of_episodes === "number"
        ? data.number_of_episodes
        : null,
    genresThemes: genres,
  };
};
