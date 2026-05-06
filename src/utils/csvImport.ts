// File: src/utils/csvImport.ts
// Purpose: CSV import field parsers: parseYearValue, parseRatingValue, mapImdbType, formatDate

// ─── Internal — types
import type { EntryMediaType } from "@/types/log-entry";

/**
 * Parses a year string, validating it's within a reasonable range (1888 to next year).
 */
export const parseYearValue = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const match = value.match(/\d{4}/);
  if (!match) return null;
  const year = Number(match[0]);
  const maxYear = new Date().getFullYear() + 1;
  if (Number.isNaN(year) || year < 1888 || year > maxYear) return null;
  return match[0];
};

/**
 * Parses a numeric rating value from a string within a specified range.
 */
export const parseRatingValue = (
  value: string | null | undefined,
  min: number,
  max: number,
): number | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null;
  return parsed;
};

/**
 * Maps common IMDb/external media type labels to Plotline EntryMediaType.
 */
export const mapImdbType = (value: string): EntryMediaType => {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("tv") || normalized.includes("series")) return "series";
  if (normalized.includes("video game") || normalized.includes("game")) return "game";
  if (normalized.includes("anime")) return "anime";
  if (normalized.includes("manga")) return "manga";
  return "movie";
};

/**
 * Formats a timestamp (ms) as a YYYY-MM-DD string.
 */
export const formatDate = (millis: number | null): string => {
  if (!millis) return "";
  const date = new Date(millis);
  if (Number.isNaN(date.getTime())) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};
