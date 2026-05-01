// File: src/lib/metadata/igdb.ts
// Purpose: IGDB API fetch functions for game metadata

// ─── Internal — types
import type { MetadataResult } from "./tmdb";

// ─── Internal — utils/lib
import { safeFetchJson } from "../safeFetch";
import { getIgdbAccessToken } from "../igdbAuth";

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

// ─── IGDB Functions

/**
 * Fetch game metadata from IGDB
 */
export const fetchIgdbMetadata = async (
  id: string | null,
  title: string | null,
): Promise<MetadataResult | null> => {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const tokenResult = await getIgdbAccessToken();
  if (!clientId || !tokenResult.token) return null;

  const resolvedQuery =
    id && /^\d+$/.test(id)
      ? `where id = ${id};`
      : title
        ? `search "${title.replace(/"/g, "")}";`
        : "";
  
  if (!resolvedQuery) return null;

  const body = `${resolvedQuery} fields id,name,summary,first_release_date,cover.url,genres.name,aggregated_rating,rating,involved_companies.company.name,involved_companies.developer,involved_companies.publisher; limit 1;`;
  
  const response = await safeFetchJson<Array<{
    id?: number;
    name?: string;
    summary?: string;
    first_release_date?: number;
    cover?: { url?: string };
    genres?: Array<{ name?: string }>;
    aggregated_rating?: number;
    rating?: number;
    involved_companies?: Array<{
      company: { name: string };
      developer: boolean;
      publisher: boolean;
    }>;
    characters?: Array<{ name?: string }>;
  }>>("https://api.igdb.com/v4/games", {
    method: "POST",
    headers: {
      "Client-ID": clientId,
      Authorization: `Bearer ${tokenResult.token}`,
      "Content-Type": "text/plain",
    },
    body,
  });
  
  if (!response.ok) return null;

  const payload = response.data;
  const data = payload?.[0];
  if (!data) return null;

  const year = data.first_release_date
    ? String(new Date(data.first_release_date * 1000).getUTCFullYear())
    : undefined;
  
  const ratingValue = normalizeIgdbRating(data.aggregated_rating ?? data.rating);

  return {
    title: data.name || "",
    description: data.summary || "",
    year,
    type: "game",
    image: formatIgdbCoverUrl(data.cover?.url),
    rating: ratingValue,
    genresThemes: Array.isArray(data.genres)
      ? data.genres.map((g) => g.name).filter((v): v is string => Boolean(v))
      : [],
    cast: Array.isArray(data.characters)
      ? data.characters
          .map((c) => c.name)
          .filter((v): v is string => Boolean(v))
          .slice(0, 10)
      : [],
    director: Array.isArray(data.involved_companies)
      ? data.involved_companies.find((c) => c.developer)?.company.name || null
      : null,
    producer: Array.isArray(data.involved_companies)
      ? data.involved_companies.find((c) => c.publisher)?.company.name || null
      : null,
  };
};
