// File: src/utils/dashboard.ts
// Purpose: Dashboard display labels and mapping for metrics and content types

// ─── Internal — types
import type { MetricCounts } from "@/types/lists";
import type { EntryMediaType } from "@/types/log-entry";

// ─── Constants: Labels
export const metricLabels: ReadonlyArray<{
  readonly key: keyof MetricCounts;
  readonly label: string;
}> = [
  { key: "month", label: "This month" },
  { key: "year", label: "This year" },
  { key: "total", label: "All time" },
] as const;

export const contentTypeLabels: Readonly<Record<EntryMediaType, string>> = {
  movie: "Movies",
  series: "Series",
  anime: "Anime",
  manga: "Manga",
  game: "Games",
} as const;
