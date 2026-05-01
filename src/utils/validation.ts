// File: src/utils/validation.ts
// Purpose: Validation and sanitization helpers for user-provided and imported data

// ─── Internal — constants
import { MAX_DESCRIPTION_LENGTH } from "@/constants/limits";

/**
 * Sanitizes and truncates descriptions to fit within application limits.
 */
export const sanitizeDescription = (description: string | null | undefined): string => {
  if (!description) return "";
  return description.trim().slice(0, MAX_DESCRIPTION_LENGTH);
};

/**
 * Legacy alias for sanitizeDescription used in import flows.
 */
export const sanitizeImportedDescription = sanitizeDescription;
