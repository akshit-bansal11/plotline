// File: src/hooks/useDashboardData.ts
// Purpose: Hook to compute dashboard metrics grouped by media type

// ─── React
import { useMemo } from "react";

// ─── Internal — types
import type { EntryDoc, EntryMediaType } from "@/types/log-entry";
import type { MetricCounts } from "@/types/lists";

export type GroupedMetrics = Record<EntryMediaType, MetricCounts>;

/**
 * Computes dashboard metrics grouped by media type.
 */
export const useDashboardData = (entries: EntryDoc[]): GroupedMetrics => {
  return useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const initial: GroupedMetrics = {
      movie: { month: 0, year: 0, total: 0 },
      series: { month: 0, year: 0, total: 0 },
      anime: { month: 0, year: 0, total: 0 },
      manga: { month: 0, year: 0, total: 0 },
      game: { month: 0, year: 0, total: 0 },
    };

    return entries.reduce((acc, entry) => {
      const type = entry.mediaType as EntryMediaType;
      if (!acc[type]) return acc;

      acc[type].total += 1;

      if (!entry.completedAtMs) return acc;

      const date = new Date(entry.completedAtMs);
      if (date.getFullYear() === currentYear) {
        acc[type].year += 1;
        if (date.getMonth() === currentMonth) {
          acc[type].month += 1;
        }
      }

      return acc;
    }, initial);
  }, [entries]);
};
