// File: src/services/import-export.ts
// Purpose: Core logic for CSV parsing, data mapping, and Firestore batch operations for import/export

// ─── Firebase
import { collection, getDocs, limit, orderBy, query, Timestamp } from "firebase/firestore";

// ─── Internal — services
import { db } from "@/lib/firebase";

// ─── Internal — types
import type {
  EntryMediaType as BaseEntryMediaType,
  EntryStatusValue as EntryStatus,
} from "@/types/log-entry";

type EntryMediaType = BaseEntryMediaType | "anime_movie";

export type EntryExportRow = {
  title: string;
  mediaType: EntryMediaType;
  status: EntryStatus;
  userRating: number | null;
  imdbRating: number | null;
  lengthMinutes: number | null;
  episodeCount: number | null;
  chapterCount: number | null;
  genresThemes: string[];
  description: string;
  releaseYear: string | null;
  image: string | null;
  completedAt: number | null;
  createdAt: number | null;
};

// ─── CSV Utilities
export const escapeCsv = (value: string) => {
  const normalized = value.replace(/"/g, '""');
  if (normalized.includes(",") || normalized.includes("\n") || normalized.includes('"')) {
    return `"${normalized}"`;
  }
  return normalized;
};

export const parseCsv = (text: string) => {
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
      if (current.length > 1 || current[0]?.trim()) rows.push(current);
      current = [];
      continue;
    }
    field += char;
  }
  current.push(field);
  if (current.length > 1 || current[0]?.trim()) rows.push(current);
  return rows;
};

export const normalizeHeader = (value: string) => value.trim().toLowerCase();

export const parseYearValue = (value: string | null | undefined) => {
  if (!value) return null;
  const match = value.match(/\d{4}/);
  if (!match) return null;
  const year = Number(match[0]);
  const maxYear = new Date().getFullYear() + 1;
  if (Number.isNaN(year) || year < 1888 || year > maxYear) return null;
  return match[0];
};

export const parseRatingValue = (value: string | null | undefined, min: number, max: number) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null;
  return parsed;
};

export const mapImdbType = (value: string): EntryMediaType => {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("tv") || normalized.includes("series")) return "series";
  if (normalized.includes("video game") || normalized.includes("game")) return "game";
  if (normalized.includes("anime")) return "anime";
  if (normalized.includes("manga")) return "manga";
  return "movie";
};

export const formatDate = (millis: number | null) => {
  if (!millis) return "";
  const date = new Date(millis);
  if (Number.isNaN(date.getTime())) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

// ─── Firestore Operations

/**
 * Fetches all user entries for export.
 */
export async function getEntriesForExport(uid: string): Promise<EntryExportRow[]> {
  const snapshot = await getDocs(
    query(collection(db, "users", uid, "entries"), orderBy("createdAt", "desc")),
  );
  const rows: EntryExportRow[] = [];
  snapshot.forEach((docSnap) => {
    const data = docSnap.data() as Record<string, unknown>;
    const releaseYearRaw = data.releaseYear ?? data.year ?? null;
    const userRating =
      typeof data.userRating === "number"
        ? data.userRating
        : typeof data.rating === "number"
          ? data.rating
          : null;
    rows.push({
      title: String(data.title || ""),
      mediaType: data.mediaType as EntryMediaType,
      status: data.status as EntryStatus,
      userRating,
      imdbRating: typeof data.imdbRating === "number" ? data.imdbRating : null,
      lengthMinutes: typeof data.lengthMinutes === "number" ? data.lengthMinutes : null,
      episodeCount: typeof data.episodeCount === "number" ? data.episodeCount : null,
      chapterCount: typeof data.chapterCount === "number" ? data.chapterCount : null,
      genresThemes: Array.isArray(data.genresThemes) ? (data.genresThemes as string[]) : [],
      description: String(data.description || ""),
      releaseYear: releaseYearRaw ? String(releaseYearRaw) : null,
      image: typeof data.image === "string" ? data.image : null,
      completedAt: data.completedAt instanceof Timestamp ? data.completedAt.toMillis() : null,
      createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : null,
    });
  });
  return rows;
}

/**
 * Fetches existing entries to prevent duplicates during import.
 */
export async function getExistingLibrary(uid: string) {
  const snapshot = await getDocs(query(collection(db, "users", uid, "entries"), limit(2000)));
  const existing: { title: string; mediaType: string; year: string }[] = [];
  snapshot.forEach((doc) => {
    const raw = doc.data() as Record<string, unknown>;
    existing.push({
      title: typeof raw.title === "string" ? raw.title.trim().toLowerCase() : "",
      mediaType: typeof raw.mediaType === "string" ? raw.mediaType : "movie",
      year:
        typeof raw.releaseYear === "string"
          ? raw.releaseYear
          : typeof raw.year === "string"
            ? raw.year
            : "",
    });
  });
  return existing;
}
