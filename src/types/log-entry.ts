// File: src/types/log-entry.ts
// Purpose: Comprehensive type definitions for media entries, status values, and relationships

// ─── Firebase
import type { FieldValue, Timestamp } from "firebase/firestore";

// ─── Media Types
export type EntryMediaType = "movie" | "series" | "anime" | "manga" | "game";

// ─── Status Types: Specific
export type MovieStatus = "completed" | "watching" | "rewatching" | "plan_to_watch" | "dropped";

export type SeriesAnimeStatus =
  | "completed"
  | "watching"
  | "rewatching"
  | "plan_to_watch"
  | "on_hold"
  | "dropped";

export type MangaStatus =
  | "completed"
  | "reading"
  | "rereading"
  | "plan_to_read"
  | "on_hold"
  | "dropped";

export type GameStatus =
  | "completed"
  | "fully_completed"
  | "playing"
  | "replaying"
  | "plan_to_play"
  | "backlogged"
  | "dropped";

// ─── Status Types: General
export type EntryStatus = MovieStatus | SeriesAnimeStatus | MangaStatus | GameStatus;

export type EntryStatusValue = EntryStatus | "unspecified";

export type LegacyEntryStatus =
  | "main_story_completed"
  | "bored"
  | "own"
  | "wishlist"
  | "not_committed"
  | "committed";

export type StoredEntryStatus = EntryStatusValue | LegacyEntryStatus;

// ─── Status Configuration
export const ENTRY_STATUS_OPTIONS_BY_MEDIA_TYPE = {
  movie: ["completed", "watching", "rewatching", "plan_to_watch", "dropped"],
  series: ["completed", "watching", "rewatching", "plan_to_watch", "on_hold", "dropped"],
  anime: ["completed", "watching", "rewatching", "plan_to_watch", "on_hold", "dropped"],
  manga: ["completed", "reading", "rereading", "plan_to_read", "on_hold", "dropped"],
  game: [
    "completed",
    "fully_completed",
    "playing",
    "replaying",
    "plan_to_play",
    "backlogged",
    "dropped",
  ],
} as const satisfies Record<EntryMediaType, readonly EntryStatus[]>;

// ─── Status Helpers
export const isCompletionStatus = (status: EntryStatusValue): status is EntryStatus =>
  status === "completed" || status === "fully_completed";

export const getStatusOptionsForMediaType = (mediaType: EntryMediaType): readonly EntryStatus[] =>
  ENTRY_STATUS_OPTIONS_BY_MEDIA_TYPE[mediaType];

/**
 * Normalizes status values, including mapping legacy statuses to modern ones.
 */
export const normalizeEntryStatus = (value: unknown): EntryStatusValue => {
  if (typeof value !== "string") return "unspecified";

  const validStatuses: EntryStatusValue[] = [
    "completed",
    "watching",
    "rewatching",
    "plan_to_watch",
    "dropped",
    "on_hold",
    "reading",
    "rereading",
    "plan_to_read",
    "fully_completed",
    "playing",
    "replaying",
    "plan_to_play",
    "backlogged",
    "unspecified",
  ];

  if (validStatuses.includes(value as EntryStatusValue)) {
    return value as EntryStatusValue;
  }

  // Legacy mappings
  if (value === "main_story_completed") return "completed";
  if (value === "not_committed" || value === "committed") return "playing";
  if (value === "wishlist") return "plan_to_play";
  if (value === "own") return "backlogged";
  if (value === "bored") return "dropped";

  return "unspecified";
};

// ─── Relationship Types
export interface EditableRelation {
  targetId: string;
  type: string;
  title: string;
  image: string | null;
  mediaType: string;
  createdAtMs?: number;
}

export interface EntryRelation {
  targetId: string;
  type: string;
  createdAtMs: number;
  inferred?: boolean;
}

// ─── Entry Data Models
export interface EntryDoc {
  id: string;
  title: string;
  mediaType: EntryMediaType;
  status: EntryStatusValue;
  userRating: number | null;
  imdbRating: number | null;
  notes: string;
  description: string;
  image: string | null;
  releaseYear: string | null;
  year: string | null;
  externalId: string | null;
  lengthMinutes: number | null;
  episodeCount: number | null;
  chapterCount: number | null;
  totalSeasons: number;
  // Game specific
  playTime: number | null;
  achievements: number | null;
  totalAchievements: number | null;
  platform: string | null;
  // User progress fields
  currentEpisodes: number;
  currentSeasons: number;
  currentChapters: number;
  rewatchCount: number;
  currentVolumes: number;
  volumeCount: number;
  director: string | null;
  producer: string | null;
  cast: string[];
  startDate: string | null;
  isMovie: boolean;
  listIds: string[];
  createdAtMs: number | null;
  completedAtMs: number | null;
  completionDateUnknown: boolean;
  genresThemes: string[];
  relations: EntryRelation[];
}

export type LoggableMedia = Partial<EntryDoc> & {
  id: string | number;
  title: string;
  image: string | null;
  type: EntryMediaType | "anime_movie";
  rating?: string | number | null;
};

export interface LogEntryData {
  title: string;
  mediaType: EntryMediaType;
  status: EntryStatusValue;
  director: string | null;
  userRating: number | null;
  imdbRating: number | null;
  releaseYear: string | null;
  year: string | null;
  lengthMinutes: number | null;
  episodeCount: number | null;
  chapterCount: number | null;
  playTime: number | null;
  achievements: number | null;
  totalAchievements: number | null;
  platform: string | null;
  isMovie: boolean;
  genresThemes: string[];
  description: string;
  image: string | null;
  completedAt: Timestamp | null;
  completionDateUnknown: boolean;
  updatedAt: FieldValue;
  listIds: string[];
  currentEpisodes: number;
  currentSeasons: number;
  totalSeasons: number;
  currentChapters: number;
  currentVolumes: number;
  volumeCount: number;
  rewatchCount: number;
  producer: string | null;
  cast: string[];
  startDate: string | null;
  relations: EntryRelation[];
  externalId?: string | null;
}
