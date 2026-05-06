// File: src/utils/date.ts
// Purpose: Date formatting and manipulation utilities

/**
 * Formats a timestamp (ms) as a YYYY-MM-DD string.
 * This is the standard format for HTML date inputs.
 */
export const formatISODate = (millis: number): string => {
  const date = new Date(millis);
  if (Number.isNaN(date.getTime())) return "";

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
};
