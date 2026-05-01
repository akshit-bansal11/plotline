// File: src/utils/lists.ts
// Purpose: List-related utilities for type coercion and timestamp normalization

// ─── Internal — types
import type { EntryMediaType } from "@/types/log-entry";

/**
 * Coerces a value to a valid EntryMediaType, defaulting to 'movie'.
 */
export const coerceListType = (value: unknown): EntryMediaType => {
  const validTypes: EntryMediaType[] = ["movie", "series", "anime", "manga", "game"];
  if (typeof value === "string" && validTypes.includes(value as EntryMediaType)) {
    return value as EntryMediaType;
  }
  return "movie";
};

/**
 * Safely converts a value (number or Firestore Timestamp) to milliseconds.
 */
export const toMillis = (value: unknown): number | null => {
  if (!value) return null;
  
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  
  if (
    typeof value === "object" &&
    value !== null &&
    "toMillis" in value &&
    typeof (value as { toMillis?: unknown }).toMillis === "function"
  ) {
    const millis = (value as { toMillis: () => number }).toMillis();
    return Number.isFinite(millis) ? millis : null;
  }
  
  return null;
};
