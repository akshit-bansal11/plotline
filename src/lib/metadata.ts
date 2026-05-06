// File: src/lib/metadata.ts
// Purpose: Centralized orchestration for fetching and merging media metadata from various providers

import { fetchIgdbMetadata } from "@/lib/metadata/igdb";
import { fetchMalMetadata } from "@/lib/metadata/mal";
import { logMissingFields, mergeMetadata } from "@/lib/metadata/merge";
import { fetchOmdbMetadata } from "@/lib/metadata/omdb";
import type { MetadataResult } from "@/lib/metadata/tmdb";
// ─── Internal — services
import { fetchTmdbMetadata } from "@/lib/metadata/tmdb";
// ─── Internal — types
import type { EntryMediaType } from "@/types/log-entry";

// ─── Types
export type { MetadataResult };

export interface MetadataQueryParams {
  type: EntryMediaType;
  id?: string | null;
  title?: string | null;
  year?: string | null;
}

// ─── Core Service: Metadata Enrichment
/**
 * Orchestrates metadata fetching from appropriate providers based on media type.
 * For movies/series, it merges TMDB and OMDB data.
 * For anime/manga, it uses MAL.
 * For games, it uses IGDB.
 */
export async function getEnrichedMetadata({
  type,
  id,
  title,
  year,
}: MetadataQueryParams): Promise<MetadataResult | null> {
  const mediaType = type as EntryMediaType;

  if (mediaType === "movie" || mediaType === "series") {
    const [tmdb, omdb] = await Promise.all([
      fetchTmdbMetadata(id ?? null, title ?? null, mediaType, year),
      fetchOmdbMetadata(id ?? null, title ?? null, mediaType, year),
    ]);

    logMissingFields("tmdb", tmdb, mediaType, { id, title, year });
    logMissingFields("omdb", omdb, mediaType, { id, title, year });

    return mergeMetadata(tmdb, omdb);
  }

  if (mediaType === "anime" || mediaType === "manga") {
    return id ? await fetchMalMetadata(id, mediaType) : null;
  }

  if (mediaType === "game") {
    return await fetchIgdbMetadata(id ?? null, title ?? null);
  }

  return null;
}
