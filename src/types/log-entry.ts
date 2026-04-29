import type { FieldValue, Timestamp } from "firebase/firestore";

export type EntryMediaType = "movie" | "series" | "anime" | "manga" | "game";

export type MovieStatus =
  | "completed"
  | "watching"
  | "rewatching"
  | "plan_to_watch"
  | "dropped";

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

export type ListMediaType = "movie" | "series" | "anime" | "manga" | "game";

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

export const isCompletionStatus = (status: EntryStatusValue): status is EntryStatus =>
  status === "completed" || status === "fully_completed";

export const getStatusOptionsForMediaType = (
  mediaType: EntryMediaType,
): readonly EntryStatus[] => ENTRY_STATUS_OPTIONS_BY_MEDIA_TYPE[mediaType];

export const normalizeEntryStatus = (value: unknown): EntryStatusValue => {
  if (typeof value !== "string") return "unspecified";
  if (
    value === "completed" ||
    value === "watching" ||
    value === "rewatching" ||
    value === "plan_to_watch" ||
    value === "dropped" ||
    value === "on_hold" ||
    value === "reading" ||
    value === "rereading" ||
    value === "plan_to_read" ||
    value === "fully_completed" ||
    value === "playing" ||
    value === "replaying" ||
    value === "plan_to_play" ||
    value === "backlogged" ||
    value === "unspecified"
  ) {
    return value;
  }

  if (value === "main_story_completed") return "completed";
  if (value === "not_committed" || value === "committed") return "playing";
  if (value === "wishlist") return "plan_to_play";
  if (value === "own") return "backlogged";
  if (value === "bored") return "dropped";
  return "unspecified";
};

export type EditableRelation = {
  targetId: string;
  type: string;
  title: string;
  image: string | null;
  mediaType: string;
};

export type LoggableMedia = {
  id: string | number;
  title: string;
  image: string | null;
  year?: string;
  releaseYear?: string;
  type: EntryMediaType | "anime_movie";
  description?: string;
  userRating?: number | null;
  imdbRating?: number | null;
  rating?: number | null;
  lengthMinutes?: number | null;
  episodeCount?: number | null;
  chapterCount?: number | null;
  playTime?: number | null;
  achievements?: number | null;
  totalAchievements?: number | null;
  platform?: string | null;
  isMovie?: boolean;
  listIds?: string[];
  genresThemes?: string[];
  cast?: string[];
  status?: EntryStatusValue;
  completedAt?: number | null;
  completionDateUnknown?: boolean;
  relations?: {
    targetId: string;
    type: string;
    createdAtMs: number;
    inferred?: boolean;
  }[];
  director?: string | null;
  producer?: string | null;
};
export type LogEntryData = {
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
  relations: { targetId: string; type: string; createdAtMs: number }[];
  externalId?: string | null;
};
