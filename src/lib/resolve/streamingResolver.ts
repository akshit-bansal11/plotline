// File: src/lib/resolve/streamingResolver.ts
// Purpose: Netflix and Prime Video URL scraping and title resolver

// ─── Internal — types
import type { ParsedMediaUrl } from "@/utils/parseMediaUrl";
import type { ResolvedMedia, ResolvedMediaType } from "@/lib/resolve/types";

// ─── Internal — utils/lib
import { safeFetchJson, safeFetchHtml } from "@/lib/safeFetch";

// ─── Constants & Helpers
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

// ─── Resolver Functions

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
