// File: src/lib/search/igdbSearch.ts
// Purpose: IGDB game search functions

// ─── Internal — types
import type { SearchResult } from "./tmdbSearch";

export interface IgdbGame {
  id: number;
  name?: string;
  cover?: { url?: string };
  first_release_date?: number;
  summary?: string;
  genres?: Array<{ name?: string }>;
  platforms?: Array<{ name?: string }>;
  rating?: number;
  aggregated_rating?: number;
  total_rating?: number;
}

import { normalizeGamePlatform, normalizeGenreName } from "@/utils/searchFilters";
import { getIgdbAccessToken } from "../igdbAuth";
// ─── Internal — utils/lib
import { safeFetchJson } from "../safeFetch";

// ─── Constants & Helpers
const formatIgdbCoverUrl = (url?: string) => {
  if (!url) return null;
  const normalized = url.startsWith("//") ? `https:${url}` : url;
  return normalized.replace("t_thumb", "t_cover_big");
};

const round1 = (value: number) => Math.round(value * 10) / 10;

const normalizeIgdbRating = (value?: number) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return round1(value / 10);
};

const normalizeGenres = (genres: Array<string | null | undefined>) => {
  const set = new Set<string>();
  genres.forEach((genre) => {
    const normalized = normalizeGenreName(genre);
    if (normalized) set.add(normalized);
  });
  return Array.from(set);
};

// ─── IGDB Functions

/**
 * Search IGDB for video games
 */
export const searchIGDBGames = async (
  queryValue: string,
): Promise<{ results: SearchResult[]; error: string }> => {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const tokenResult = await getIgdbAccessToken();
  if (!clientId || !tokenResult.token) {
    return { results: [], error: tokenResult.error };
  }

  const sanitized = queryValue.replace(/"/g, "").trim();
  const body = `search "${sanitized}"; fields id,name,cover.url,first_release_date,summary,genres.name,platforms.name,aggregated_rating,rating,total_rating; limit 20;`;

  const response = await safeFetchJson<IgdbGame[]>("https://api.igdb.com/v4/games", {
    method: "POST",
    headers: {
      "Client-ID": clientId,
      Authorization: `Bearer ${tokenResult.token}`,
      "Content-Type": "text/plain",
    },
    body,
  });

  if (!response.ok) return { results: [], error: response.error };

  const payload = response.data;

  const results: SearchResult[] = (payload || []).map((item) => {
    const year = item.first_release_date
      ? String(new Date(item.first_release_date * 1000).getUTCFullYear())
      : "";

    const ratingValue = normalizeIgdbRating(
      item.aggregated_rating ?? item.total_rating ?? item.rating,
    );

    const genres = normalizeGenres((item.genres || []).map((genre) => genre.name));

    const normalizedPlatforms = (item.platforms || [])
      .map((platform) => normalizeGamePlatform(platform.name))
      .filter((platform): platform is string => Boolean(platform));

    const platforms = Array.from(new Set(normalizedPlatforms));

    return {
      id: String(item.id),
      title: item.name || "",
      image: formatIgdbCoverUrl(item.cover?.url),
      year,
      type: "game",
      overview: item.summary || "",
      rating: ratingValue,
      genres,
      platforms,
    };
  });

  return { results, error: "" };
};
