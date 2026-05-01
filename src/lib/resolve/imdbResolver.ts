// File: src/lib/resolve/imdbResolver.ts
// Purpose: IMDb URL to media metadata resolver

// ─── Internal — types
import type { ParsedMediaUrl } from "@/utils/parseMediaUrl";
import type { ResolvedMedia, ResolvedMediaType } from "@/lib/resolve/types";

// ─── Internal — utils/lib
import { safeFetchJson } from "@/lib/safeFetch";

// ─── Constants & Helpers
const parseYear = (value?: string | null) => (value ? value.split("-")[0] : undefined);
const round1 = (value: number) => Math.round(value * 10) / 10;

// ─── Resolver Functions

/**
 * Resolve metadata from an IMDb ID
 */
export const resolveImdb = async (parsed: ParsedMediaUrl): Promise<ResolvedMedia | null> => {
  if (!parsed.id) return null;
  const apiKey = process.env.OMDB_API_KEY;
  if (!apiKey) return null;

  const url = `https://www.omdbapi.com/?apikey=${apiKey}&i=${encodeURIComponent(parsed.id)}&plot=full`;
  const response = await safeFetchJson<{
    Response?: string;
    Title?: string;
    Year?: string;
    Plot?: string;
    Runtime?: string;
    Genre?: string;
    Poster?: string;
    imdbRating?: string;
    Type?: string;
  }>(url);
  if (!response.ok || response.data.Response === "False") return null;

  const data = response.data;
  const type: ResolvedMediaType = data.Type === "series" ? "series" : "movie";
  const rawRating = data.imdbRating && data.imdbRating !== "N/A" ? Number(data.imdbRating) : null;
  const rating = typeof rawRating === "number" && Number.isFinite(rawRating) ? round1(rawRating) : null;
  const genres = data.Genre && data.Genre !== "N/A" ? data.Genre.split(",").map(g => g.trim()).filter(Boolean) : [];
  const runtimeMatch = data.Runtime?.match(/(\d+)/);
  const lengthMinutes = runtimeMatch ? Number(runtimeMatch[1]) : null;
  const isAnimeGenre = genres.some(g => g.toLowerCase() === "animation" || g.toLowerCase() === "anime");

  // Try TMDB find endpoint for better image and rating
  const bearerToken = process.env.TMDB_BEARER_TOKEN;
  const tmdbApiKey = process.env.TMDB_API_KEY;
  if (bearerToken || tmdbApiKey) {
    const findUrl = bearerToken
      ? `https://api.themoviedb.org/3/find/${parsed.id}?external_source=imdb_id&language=en-US`
      : `https://api.themoviedb.org/3/find/${parsed.id}?external_source=imdb_id&language=en-US&api_key=${tmdbApiKey}`;
    const headers = bearerToken ? { Authorization: `Bearer ${bearerToken}` } : undefined;
    const findRes = await safeFetchJson<{
      movie_results?: Array<{ id?: number; poster_path?: string | null; vote_average?: number }>;
      tv_results?: Array<{ id?: number; poster_path?: string | null; vote_average?: number }>;
    }>(findUrl, { headers });

    if (findRes.ok) {
      const posterPath = findRes.data.movie_results?.[0]?.poster_path || findRes.data.tv_results?.[0]?.poster_path;
      const tmdbRating = findRes.data.movie_results?.[0]?.vote_average || findRes.data.tv_results?.[0]?.vote_average;
      if (posterPath) {
        return {
          id: parsed.id,
          title: data.Title || "",
          image: `https://image.tmdb.org/t/p/w500${posterPath}`,
          year: data.Year?.match(/\d{4}/)?.[0],
          type: isAnimeGenre ? "anime" : type,
          description: data.Plot && data.Plot !== "N/A" ? data.Plot : undefined,
          rating: typeof tmdbRating === "number" ? round1(tmdbRating) : rating,
          imdbRating: rating,
          lengthMinutes: type === "movie" ? lengthMinutes : null,
          genresThemes: genres,
        };
      }
    }
  }

  return {
    id: parsed.id,
    title: data.Title || "",
    image: data.Poster && data.Poster !== "N/A" ? data.Poster : null,
    year: data.Year?.match(/\d{4}/)?.[0],
    type: isAnimeGenre ? "anime" : type,
    description: data.Plot && data.Plot !== "N/A" ? data.Plot : undefined,
    rating,
    imdbRating: rating,
    lengthMinutes: type === "movie" ? lengthMinutes : null,
    genresThemes: genres,
  };
};
