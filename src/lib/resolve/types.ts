// File: src/lib/resolve/types.ts
// Purpose: Shared types for media link resolution

export type ResolvedMediaType = "movie" | "series" | "anime" | "manga" | "game";

export interface ResolvedMedia {
  id: string;
  title: string;
  image: string | null;
  year?: string;
  type: ResolvedMediaType;
  description?: string;
  rating?: number | null;
  imdbRating?: number | null;
  lengthMinutes?: number | null;
  episodeCount?: number | null;
  chapterCount?: number | null;
  genresThemes?: string[];
}
