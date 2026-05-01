// File: lib/resolve-link/fetchers.ts
// Purpose: Fetch and extraction logic for the /api/resolve-link route

// ─── Internal — types
import type { ParsedMediaUrl } from "@/utils/parseMediaUrl";

export type ResolvedMediaType = "movie" | "series" | "anime" | "manga" | "game";

export interface ResolvedMedia {
  id: string;
  title: string;
  image: string | null;
  year?: string;
  type: ResolvedMediaType;
  description?: string;
  rating?: number | null;
  imdbRating?: number | null;
  lengthMinutes?: number | null;
  episodeCount?: number | null;
  chapterCount?: number | null;
  genresThemes?: string[];
}

// ─── Internal — utils/lib
import { safeFetchJson, safeFetchHtml } from "../safeFetch";

// ─── Helpers
const decodeHtmlEntities = (s: string) =>
  s
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&apos;/g, "'");

const stripServiceSuffix = (s: string) =>
  s
    .replace(/^(Netflix|Amazon|Prime Video|Apple TV\+?|Disney\+?|Hulu|HBO Max|Peacock|Paramount\+?|Crunchyroll)\s*[:|]\s*/i, "")
    .replace(/\s*[-–—|:]\s*(Netflix|Amazon|Prime Video|Watch|Stream|IMDb).*$/i, "")
    .replace(/\s*\(\d{4}\).*$/, "")
    .trim();

const extractTitleFromHtml = (html: string): string | null => {
  const jsonLdMatches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const m of jsonLdMatches) {
    try {
      const obj = JSON.parse(m[1]) as Record<string, unknown>;
      const name = (obj.name ?? obj.headline) as string | undefined;
      if (typeof name === "string" && name.length > 0 && name.length < 200) {
        return decodeHtmlEntities(stripServiceSuffix(name));
      }
    } catch { /* ignore */ }
  }

  const ogMatch =
    html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i) ||
    html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:title["']/i);
  if (ogMatch) {
    const title = decodeHtmlEntities(stripServiceSuffix(ogMatch[1]));
    if (title.length > 0 && title.length < 200) return title;
  }

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    const title = decodeHtmlEntities(stripServiceSuffix(titleMatch[1]));
    if (title.length > 0 && title.length < 200) return title;
  }

  return null;
};

const parseYear = (value?: string | null) => (value ? value.split("-")[0] : undefined);
const round1 = (value: number) => Math.round(value * 10) / 10;

// ─── Resolvers

/**
 * Resolve metadata for a specific title by searching TMDB and fallback to OMDB
 */
export const resolveByTitleSearch = async (
  title: string,
  preferredType?: ResolvedMediaType | null,
): Promise<ResolvedMedia | null> => {
  const bearerToken = process.env.TMDB_BEARER_TOKEN;
  const apiKey = process.env.TMDB_API_KEY;

  if (bearerToken || apiKey) {
    const searchUrl = bearerToken
      ? `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(title)}&include_adult=false`
      : `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(title)}&include_adult=false&api_key=${apiKey}`;
    const headers = bearerToken ? { Authorization: `Bearer ${bearerToken}` } : undefined;
    const response = await safeFetchJson<{
      results?: Array<{
        id?: number;
        title?: string;
        name?: string;
        media_type?: string;
        poster_path?: string | null;
        release_date?: string;
        first_air_date?: string;
        overview?: string;
        vote_average?: number;
      }>;
    }>(searchUrl, { headers });

    if (response.ok) {
      const match = (response.data.results || []).find(item => item.media_type === "movie" || item.media_type === "tv");
      if (match) {
        const type: ResolvedMediaType = match.media_type === "tv" ? "series" : "movie";
        return {
          id: String(match.id),
          title: match.title || match.name || title,
          image: match.poster_path ? `https://image.tmdb.org/t/p/w500${match.poster_path}` : null,
          year: parseYear(match.release_date || match.first_air_date),
          type: preferredType || type,
          description: match.overview || undefined,
          rating: typeof match.vote_average === "number" ? round1(match.vote_average) : null,
        };
      }
    }
  }

  const omdbKey = process.env.OMDB_API_KEY;
  if (omdbKey) {
    const url = `https://www.omdbapi.com/?apikey=${omdbKey}&t=${encodeURIComponent(title)}&plot=full`;
    const response = await safeFetchJson<{
      Response?: string;
      Title?: string;
      Year?: string;
      Plot?: string;
      Poster?: string;
      imdbRating?: string;
      Type?: string;
      imdbID?: string;
    }>(url);
    if (response.ok && response.data.Response !== "False" && response.data.Title) {
      const data = response.data;
      const type: ResolvedMediaType = data.Type === "series" ? "series" : "movie";
      const rating = data.imdbRating && data.imdbRating !== "N/A" ? Number(data.imdbRating) : null;
      const ratingRounded = typeof rating === "number" && Number.isFinite(rating) ? round1(rating) : null;
      return {
        id: data.imdbID || title,
        title: data.Title,
        image: data.Poster && data.Poster !== "N/A" ? data.Poster : null,
        year: data.Year?.match(/\d{4}/)?.[0],
        type: preferredType || type,
        description: data.Plot && data.Plot !== "N/A" ? data.Plot : undefined,
        rating: ratingRounded,
        imdbRating: ratingRounded,
      };
    }
  }

  return null;
};

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
  const genres = Array.isArray(data.genres) ? data.genres.map(g => g.name).filter((v): v is string => Boolean(v)) : [];

  let imdbRating: number | null = null;
  if (data.imdb_id) {
    const omdbApiKey = process.env.OMDB_API_KEY;
    if (omdbApiKey) {
      const omdbRes = await safeFetchJson<{ imdbRating?: string; Response?: string }>(
        `https://www.omdbapi.com/?apikey=${omdbApiKey}&i=${data.imdb_id}&plot=short`,
      );
      if (omdbRes.ok && omdbRes.data.Response !== "False" && omdbRes.data.imdbRating && omdbRes.data.imdbRating !== "N/A") {
        imdbRating = round1(Number(omdbRes.data.imdbRating));
        if (!Number.isFinite(imdbRating)) imdbRating = null;
      }
    }
  }

  return {
    id: parsed.id,
    title: data.title || data.name || "",
    image: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : null,
    year: parseYear(parsed.mediaType === "movie" ? data.release_date : data.first_air_date),
    type: parsed.mediaType as ResolvedMediaType,
    description: data.overview || undefined,
    rating: typeof data.vote_average === "number" ? round1(data.vote_average) : null,
    imdbRating,
    lengthMinutes: parsed.mediaType === "movie" && typeof data.runtime === "number" ? data.runtime : null,
    episodeCount: parsed.mediaType === "series" && typeof data.number_of_episodes === "number" ? data.number_of_episodes : null,
    genresThemes: genres,
  };
};

/**
 * Resolve metadata from a MyAnimeList ID
 */
export const resolveMal = async (parsed: ParsedMediaUrl): Promise<ResolvedMedia | null> => {
  if (!parsed.id || !parsed.mediaType) return null;
  const clientId = process.env.MAL_CLIENT_ID;
  if (!clientId) return null;

  const malType = parsed.mediaType === "manga" ? "manga" : "anime";
  const fields = malType === "anime"
    ? "title,main_picture,start_date,mean,synopsis,num_episodes,average_episode_duration,genres"
    : "title,main_picture,start_date,mean,synopsis,num_chapters,genres";
  
  const url = `https://api.myanimelist.net/v2/${malType}/${parsed.id}?fields=${fields}`;
  const response = await safeFetchJson<{
    title?: string;
    synopsis?: string;
    start_date?: string;
    mean?: number;
    main_picture?: { medium?: string };
    num_episodes?: number;
    average_episode_duration?: number;
    num_chapters?: number;
    genres?: Array<{ name?: string }>;
  }>(url, { headers: { "X-MAL-CLIENT-ID": clientId } });

  if (!response.ok) return null;
  const data = response.data;
  const genres = Array.isArray(data.genres) ? data.genres.map(g => g.name).filter((v): v is string => Boolean(v)) : [];

  return {
    id: parsed.id,
    title: data.title || "",
    image: data.main_picture?.medium || null,
    year: parseYear(data.start_date),
    type: parsed.mediaType as ResolvedMediaType,
    description: data.synopsis || undefined,
    rating: typeof data.mean === "number" ? round1(data.mean) : null,
    lengthMinutes: malType === "anime" && typeof data.average_episode_duration === "number" ? Math.round(data.average_episode_duration / 60) : null,
    episodeCount: malType === "anime" && typeof data.num_episodes === "number" ? data.num_episodes : null,
    chapterCount: malType === "manga" && typeof data.num_chapters === "number" ? data.num_chapters : null,
    genresThemes: genres,
  };
};

/**
 * Resolve metadata from Netflix or Prime Video by scraping the page and searching by title
 */
export const resolveNetflixOrPrime = async (parsed: ParsedMediaUrl): Promise<ResolvedMedia | null> => {
  const scrapeUrl = parsed.cleanUrl ?? parsed.originalUrl;
  const extraHeaders: Record<string, string> | undefined =
    parsed.source === "netflix"
      ? { Cookie: "nfvdid=BQF...; NetflixId=;", Referer: "https://www.netflix.com/" }
      : parsed.source === "prime"
        ? { Referer: "https://www.primevideo.com/" }
        : undefined;

  const html = await safeFetchHtml(scrapeUrl, extraHeaders);
  if (!html) return null;

  const titleFromPage = extractTitleFromHtml(html);
  if (titleFromPage) return resolveByTitleSearch(titleFromPage, null);

  return null;
};
