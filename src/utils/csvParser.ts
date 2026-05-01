// File: src/utils/csvParser.ts
// Purpose: CSV parsing utilities: escapeCsv, parseCsv, normalizeHeader

/**
 * Escapes a string for inclusion in a CSV field.
 * Wraps in quotes if it contains commas, newlines, or quotes.
 */
export const escapeCsv = (value: string): string => {
  const normalized = value.replace(/"/g, '""');
  if (normalized.includes(",") || normalized.includes("\n") || normalized.includes('"')) {
    return `"${normalized}"`;
  }
  return normalized;
};

/**
 * Parses a CSV string into a 2D array of strings.
 * Handles quoted fields and escaped quotes.
 */
export const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      current.push(field);
      field = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      current.push(field);
      field = "";
      if (current.length > 1 || (current.length === 1 && current[0]?.trim())) {
        rows.push(current);
      }
      current = [];
      continue;
    }
    field += char;
  }
  current.push(field);
  if (current.length > 1 || (current.length === 1 && current[0]?.trim())) {
    rows.push(current);
  }
  return rows;
};

/**
 * Normalizes a CSV header field for consistent lookup.
 */
export const normalizeHeader = (value: string): string => value.trim().toLowerCase();
