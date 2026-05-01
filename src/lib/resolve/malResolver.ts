// File: src/lib/resolve/malResolver.ts
// Purpose: MAL URL to media metadata resolver

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
