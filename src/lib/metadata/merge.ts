// File: src/lib/metadata/merge.ts
// Purpose: Metadata merging and validation utilities

// ─── Internal — types
import type { EntryMediaType } from "@/types/log-entry";
import type { MetadataResult } from "./tmdb";

// ─── Constants & Helpers
const isValidNumber = (value?: number | null) =>
  typeof value === "number" && Number.isFinite(value);

// ─── Merge & Validation Functions

/**
 * Identify missing required fields for a given media type in a metadata object
 */
export const getMissingFields = (data: MetadataResult | null, mediaType: EntryMediaType) => {
  const required =
    mediaType === "movie"
      ? [
          "title",
          "type",
          "lengthMinutes",
          "year",
          "rating",
          "genresThemes",
          "genreIds",
          "description",
        ]
      : [
          "title",
          "type",
          "episodeCount",
          "year",
          "rating",
          "genresThemes",
          "genreIds",
          "description",
        ];
  
  if (!data) return required;
  
  const missing: string[] = [];
  if (!data.title || data.title.trim().length === 0) missing.push("title");
  if (!data.type || data.type !== mediaType) missing.push("type");
  if (!data.description || data.description.trim().length === 0) missing.push("description");
  if (!data.year || data.year.trim().length === 0) missing.push("year");
  if (!isValidNumber(data.rating)) missing.push("rating");
  if (!Array.isArray(data.genresThemes) || data.genresThemes.length === 0)
    missing.push("genresThemes");
  if (!Array.isArray(data.genreIds) || data.genreIds.length === 0) missing.push("genreIds");
  
  if (mediaType === "movie") {
    if (!isValidNumber(data.lengthMinutes) || (data.lengthMinutes ?? 0) <= 0)
      missing.push("lengthMinutes");
  } else {
    if (!isValidNumber(data.episodeCount) || (data.episodeCount ?? 0) <= 0)
      missing.push("episodeCount");
  }
  
  return missing;
};

/**
 * Log a warning if any required fields are missing from the metadata
 */
export const logMissingFields = (
  source: string,
  data: MetadataResult | null,
  mediaType: EntryMediaType,
  context: { id?: string | null; title?: string | null; year?: string | null },
) => {
  const missing = getMissingFields(data, mediaType);
  if (missing.length === 0) return;
  
  console.warn("[metadata] missing fields", {
    source,
    mediaType,
    id: context.id || null,
    title: context.title || null,
    year: context.year || null,
    missing,
  });
};

/**
 * Deeply merge two metadata results, preferring the primary source but filling gaps with the secondary
 */
export const mergeMetadata = (
  primary: MetadataResult | null,
  secondary: MetadataResult | null,
): MetadataResult | null => {
  if (!primary && !secondary) return null;
  
  console.log("[metadata] merging", {
    primaryTitle: primary?.title,
    secondaryTitle: secondary?.title,
    primaryDirector: primary?.director,
    secondaryDirector: secondary?.director,
  });

  if (!primary) return secondary;
  if (!secondary) return primary;

  const primaryDesc = primary.description || "";
  const secondaryDesc = secondary.description || "";
  
  const genres = Array.from(
    new Set([...(primary.genresThemes || []), ...(secondary.genresThemes || [])]),
  );
  
  const genreIds = Array.from(
    new Set([...(primary.genreIds || []), ...(secondary.genreIds || [])]),
  );
  
  const cast = Array.from(new Set([...(primary.cast || []), ...(secondary.cast || [])])).slice(
    0,
    10,
  );

  return {
    title: primary.title || secondary.title,
    description: primaryDesc.length >= secondaryDesc.length ? primaryDesc : secondaryDesc,
    year: primary.year || secondary.year,
    type: primary.type || secondary.type,
    image: primary.image ?? secondary.image,
    rating:
      typeof primary.rating === "number"
        ? typeof secondary.rating === "number"
          ? Math.max(primary.rating, secondary.rating)
          : primary.rating
        : (secondary.rating ?? null),
    tmdbRating: primary.tmdbRating ?? secondary.tmdbRating ?? null,
    imdbRating: primary.imdbRating ?? secondary.imdbRating ?? null,
    lengthMinutes: primary.lengthMinutes ?? secondary.lengthMinutes ?? null,
    episodeCount: primary.episodeCount ?? secondary.episodeCount ?? null,
    chapterCount: primary.chapterCount ?? secondary.chapterCount ?? null,
    genresThemes: genres,
    genreIds,
    cast,
    director: primary.director || secondary.director || null,
    producer: primary.producer || secondary.producer || null,
  };
};
