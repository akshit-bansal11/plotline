// File: src/hooks/useDashboardStats.ts
// Purpose: Orchestrates dashboard metrics and activity data processing

"use client";

// ─── React
import { useMemo } from "react";
// ─── Internal — types
import type { EntryDoc, EntryMediaType } from "@/context/DataContext";
// ─── Internal — hooks
import { useDashboardData } from "@/hooks/useDashboardData";
import { isCompletionStatus } from "@/types/log-entry";

/**
 * Hook to process entries into dashboard-ready statistics and activity groups.
 */
export function useDashboardStats(entries: EntryDoc[]) {
  // ─── Data: Metrics
  const completedEntries = useMemo(
    () => entries.filter((e) => isCompletionStatus(e.status)),
    [entries],
  );

  const metricsByType = useDashboardData(completedEntries);

  const heroStats = useMemo(
    () => ({
      movies: metricsByType.movie.total,
      series: metricsByType.series.total,
      anime: metricsByType.anime.total,
      manga: metricsByType.manga.total,
      games: metricsByType.game.total,
    }),
    [metricsByType],
  );

  // ─── Data: Recent Activity
  const recentByType = useMemo(() => {
    const grouped: Record<EntryMediaType, EntryDoc[]> = {
      movie: [],
      series: [],
      anime: [],
      manga: [],
      game: [],
    };
    entries.forEach((e) => {
      const type = e.mediaType as EntryMediaType;
      if (grouped[type]) {
        grouped[type].push(e);
      }
    });

    // Sort each group by completion/creation
    (Object.keys(grouped) as EntryMediaType[]).forEach((type) => {
      grouped[type].sort(
        (a, b) => (b.completedAtMs || b.createdAtMs || 0) - (a.completedAtMs || a.createdAtMs || 0),
      );
    });
    return grouped;
  }, [entries]);

  return {
    metricsByType,
    heroStats,
    recentByType,
  };
}
