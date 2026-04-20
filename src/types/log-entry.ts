import type { FieldValue, Timestamp } from "firebase/firestore";

export type EntryMediaType = "movie" | "series" | "anime" | "manga" | "game";

export type EntryStatus =
  | "watching"
  | "completed"
  | "plan_to_watch"
  | "on_hold"
  | "dropped"
  | "unspecified"
  | "main_story_completed"
  | "fully_completed"
  | "backlogged"
  | "bored"
  | "own"
  | "wishlist"
  | "not_committed"
  | "committed";

export type ListMediaType = "movie" | "series" | "anime" | "manga" | "game";

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
  status?: EntryStatus;
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
  status: EntryStatus;
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
