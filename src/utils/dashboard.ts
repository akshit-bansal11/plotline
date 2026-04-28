import type { EntryMediaType } from "@/context/DataContext";
import type { MetricCounts } from "@/types/lists";

export const metricLabels: Array<{ key: keyof MetricCounts; label: string }> = [
  { key: "month", label: "This month" },
  { key: "year", label: "This year" },
  { key: "total", label: "All time" },
];

export const contentTypeLabels: Record<EntryMediaType, string> = {
  movie: "Movies",
  series: "Series",
  anime: "Anime",
  manga: "Manga",
  game: "Games",
};
