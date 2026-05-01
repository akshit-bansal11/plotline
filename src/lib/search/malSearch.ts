// File: src/lib/search/malSearch.ts
// Purpose: MAL anime and manga search functions

// ─── Internal — types
import type { SearchResult } from "./tmdbSearch";

export interface MalNode {
  id: number;
  title: string;
  main_picture?: { medium?: string };
  start_date?: string;
  synopsis?: string;
  mean?: number;
  media_type?: string;
  status?: string;
  num_episodes?: number;
  num_chapters?: number;
  genres?: Array<{ name?: string }>;
  studios?: Array<{ name?: string }>;
  serialization?: Array<{ name?: string } | { node?: { name?: string } }>;
}

export interface MalItem {
  node: MalNode;
}

// ─── Internal — utils/lib
import { safeFetchJson } from "../safeFetch";
import { 
  normalizeGenreName, 
  normalizeSerializationName, 
  normalizeStatusName, 
  normalizeStudioName, 
  normalizeSubtype 
} from "@/utils/searchFilters";

// ─── Constants & Helpers
const normalizeGenres = (genres: Array<string | null | undefined>) => {
  const set = new Set<string>();
  genres.forEach((genre) => {
    const normalized = normalizeGenreName(genre);
    if (normalized) set.add(normalized);
  });
  return Array.from(set);
};

const extractMalSerialization = (value: MalNode["serialization"]) => {
  if (!Array.isArray(value)) return null;

  for (const entry of value) {
    if (entry && typeof entry === "object") {
      const directName = "name" in entry ? (entry as { name?: string }).name : null;
      const nestedName = "node" in entry ? (entry as { node?: { name?: string } }).node?.name : null;
      const normalized = normalizeSerializationName(directName || nestedName || null);
      if (normalized) return normalized;
    }
  }

  return null;
};

// ─── MAL Functions

/**
 * Search MyAnimeList for anime
 */
export const searchMALAnime = async (
  queryValue: string,
): Promise<{ results: SearchResult[]; error: string }> => {
  const clientId = process.env.MAL_CLIENT_ID;
  if (!clientId) {
    return { results: [], error: "Anime data provider is not configured." };
  }

  const fields = "title,main_picture,start_date,mean,synopsis,media_type,status,num_episodes,genres,studios";
  const url = `https://api.myanimelist.net/v2/anime?q=${encodeURIComponent(queryValue)}&limit=12&fields=${fields}`;
  
  const response = await safeFetchJson<{ data?: MalItem[] }>(url, {
    headers: { "X-MAL-CLIENT-ID": clientId },
  });
  
  if (!response.ok) return { results: [], error: response.error };

  const rawResults = response.data.data || [];

  const results: SearchResult[] = rawResults.map((item) => {
    const genres = normalizeGenres((item.node.genres || []).map((genre) => genre.name));
    const studioCandidates = (item.node.studios || [])
      .map((candidate) => normalizeStudioName(candidate.name))
      .filter((candidate): candidate is string => Boolean(candidate));
    const studio = studioCandidates[0] || null;
    const subtype = normalizeSubtype("anime", item.node.media_type);

    return {
      id: String(item.node.id),
      title: item.node.title,
      image: item.node.main_picture?.medium || null,
      year: item.node.start_date ? item.node.start_date.split("-")[0] : "",
      type: "anime",
      overview: item.node.synopsis || "",
      rating: item.node.mean ?? null,
      genres,
      subtype,
      status: normalizeStatusName(item.node.status),
      episodeCount: typeof item.node.num_episodes === "number" ? item.node.num_episodes : null,
      studio,
    };
  });

  return { results, error: "" };
};

/**
 * Search MyAnimeList for manga
 */
export const searchMALManga = async (
  queryValue: string,
): Promise<{ results: SearchResult[]; error: string }> => {
  const clientId = process.env.MAL_CLIENT_ID;
  if (!clientId) {
    return { results: [], error: "Manga data provider is not configured." };
  }

  const fields = "title,main_picture,start_date,mean,synopsis,media_type,status,num_chapters,genres,serialization";
  const url = `https://api.myanimelist.net/v2/manga?q=${encodeURIComponent(queryValue)}&limit=12&fields=${fields}`;
  
  const response = await safeFetchJson<{ data?: MalItem[] }>(url, {
    headers: { "X-MAL-CLIENT-ID": clientId },
  });
  
  if (!response.ok) return { results: [], error: response.error };

  const rawResults = response.data.data || [];

  const results: SearchResult[] = rawResults.map((item) => {
    const genres = normalizeGenres((item.node.genres || []).map((genre) => genre.name));

    return {
      id: String(item.node.id),
      title: item.node.title,
      image: item.node.main_picture?.medium || null,
      year: item.node.start_date ? item.node.start_date.split("-")[0] : "",
      type: "manga",
      overview: item.node.synopsis || "",
      rating: item.node.mean ?? null,
      genres,
      subtype: normalizeSubtype("manga", item.node.media_type),
      status: normalizeStatusName(item.node.status),
      chapterCount: typeof item.node.num_chapters === "number" ? item.node.num_chapters : null,
      serialization: extractMalSerialization(item.node.serialization),
    };
  });

  return { results, error: "" };
};
