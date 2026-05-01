// File: src/lib/metadata/mal.ts
// Purpose: MyAnimeList API fetch functions for anime/manga metadata

// ─── Internal — types
import type { EntryMediaType } from "@/types/log-entry";
import type { MetadataResult } from "./tmdb";

// ─── Internal — utils/lib
import { safeFetchJson } from "../safeFetch";

// ─── Constants & Helpers
const parseYear = (value?: string | null) => (value ? value.split("-")[0] : undefined);
const round1 = (value: number) => Math.round(value * 10) / 10;

// ─── MAL Functions

/**
 * Fetch anime/manga metadata from MyAnimeList and Jikan (for staff/characters)
 */
export const fetchMalMetadata = async (
  id: string,
  mediaType: EntryMediaType,
): Promise<MetadataResult | null> => {
  const clientId = process.env.MAL_CLIENT_ID;
  if (!clientId) return null;
  if (mediaType !== "anime" && mediaType !== "manga") return null;

  const fields =
    mediaType === "anime"
      ? "title,main_picture,start_date,mean,synopsis,num_episodes,average_episode_duration,genres,studios"
      : "title,main_picture,start_date,mean,synopsis,num_chapters,genres,authors{first_name,last_name},serialization";
  
  const url = `https://api.myanimelist.net/v2/${mediaType}/${encodeURIComponent(id)}?fields=${fields}`;
  
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
    studios?: Array<{ name?: string }>;
    authors?: Array<{ node: { first_name?: string; last_name?: string } }>;
    staff?: Array<{ node: { first_name?: string; last_name?: string }; role?: string }>;
    characters?: Array<{ node: { name?: string } }>;
    serialization?: Array<{ node?: { name?: string }; name?: string }>;
  }>(url, {
    headers: { "X-MAL-CLIENT-ID": clientId },
  });

  if (!response.ok) {
    throw new Error(`MAL fetch failed for url ${url} with error: ${response.error}`);
  }

  const data = response.data;

  // ─── Fetch extra data from Jikan
  if (mediaType === "anime") {
    try {
      const charRes = await safeFetchJson<{ data?: Array<{ character: { name: string } }> }>(
        `https://api.jikan.moe/v4/anime/${encodeURIComponent(id)}/characters`,
      );
      if (charRes.ok && charRes.data.data) {
        data.characters = charRes.data.data
          .slice(0, 10)
          .map((c) => ({ node: { name: c.character.name } }));
      }

      const staffRes = await safeFetchJson<{
        data?: Array<{ person: { name: string }; positions: string[] }>;
      }>(`https://api.jikan.moe/v4/anime/${encodeURIComponent(id)}/staff`);
      
      if (staffRes.ok && staffRes.data.data) {
        data.staff = staffRes.data.data.map((s) => ({
          node: { first_name: s.person.name, last_name: "" },
          role: s.positions.join(", "),
        }));
      }
    } catch (e) {
      console.warn("[metadata] fetch jikan anime failed", e);
    }
  } else if (mediaType === "manga") {
    try {
      const charRes = await safeFetchJson<{ data?: Array<{ character: { name: string } }> }>(
        `https://api.jikan.moe/v4/manga/${encodeURIComponent(id)}/characters`,
      );
      if (charRes.ok && charRes.data.data) {
        data.characters = charRes.data.data
          .slice(0, 10)
          .map((c) => ({ node: { name: c.character.name } }));
      }
    } catch (e) {
      console.warn("[metadata] fetch jikan manga failed", e);
    }
  }

  const lengthMinutes =
    mediaType === "anime" && typeof data.average_episode_duration === "number"
      ? Math.round(data.average_episode_duration / 60)
      : null;

  return {
    title: data.title || "",
    description: data.synopsis || "",
    year: parseYear(data.start_date),
    type: mediaType,
    image: data.main_picture?.medium || null,
    rating: typeof data.mean === "number" ? round1(data.mean) : null,
    lengthMinutes,
    episodeCount:
      mediaType === "anime" && typeof data.num_episodes === "number" ? data.num_episodes : null,
    chapterCount:
      mediaType === "manga" && typeof data.num_chapters === "number" ? data.num_chapters : null,
    genresThemes: Array.isArray(data.genres)
      ? data.genres.map((g) => g.name).filter((v): v is string => Boolean(v))
      : [],
    cast: Array.isArray(data.characters)
      ? data.characters
          .slice(0, 5)
          .map((c) => c.node.name)
          .filter((v): v is string => Boolean(v))
      : [],
    director:
      mediaType === "manga" && Array.isArray(data.authors)
        ? data.authors
            .map((a) => `${a.node.first_name || ""} ${a.node.last_name || ""}`.trim())
            .join(", ")
        : mediaType === "anime" && Array.isArray(data.staff)
          ? data.staff
              .filter((s) => s.role?.toLowerCase().includes("director"))
              .map((s) => `${s.node.first_name || ""} ${s.node.last_name || ""}`.trim())
              .slice(0, 2)
              .join(", ") || null
          : null,
    producer: (() => {
      if (mediaType === "anime" && Array.isArray(data.studios) && data.studios.length > 0) {
        return data.studios[0]?.name || null;
      }
      if (
        mediaType === "manga" &&
        Array.isArray(data.serialization) &&
        data.serialization.length > 0
      ) {
        const s = data.serialization[0];
        if (!s) return null;
        if ("name" in s && typeof s.name === "string") return s.name;
        if ("node" in s && s.node && typeof s.node.name === "string") return s.node.name;
      }
      return null;
    })(),
  };
};
