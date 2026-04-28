"use client";

import { Star } from "lucide-react";
import Image from "next/image";
import { useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import type { EntryDoc, EntryMediaType } from "@/context/DataContext";
import type { MetricCounts } from "@/types/lists";
import { cn, entryStatusLabels } from "@/utils";
import { contentTypeLabels, metricLabels } from "@/utils/dashboard";
import { formatISODate } from "@/utils/date";
import { Hero } from "../library/Hero";
import { GlassCard } from "../ui/GlassCard";

export function DashboardSection({
  entries,
  status,
  error,
  onRetry,
  onSelectEntry,
}: {
  entries: EntryDoc[];
  status: string;
  error: string | null;
  onRetry: () => void;
  onSelectEntry: (entry: EntryDoc) => void;
}) {
  const { user } = useAuth();
  const uid = user?.uid || null;

  const completedEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (entry.status === "completed") return true;
      if (
        entry.mediaType === "game" &&
        (entry.status === "main_story_completed" || entry.status === "fully_completed")
      )
        return true;
      return false;
    });
  }, [entries]);

  const metricsByType = useMemo(() => {
    const now = new Date();
    const nowMs = now.getTime();
    const startMonthMs = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const startYearMs = new Date(now.getFullYear(), 0, 1).getTime();

    const base: Record<EntryMediaType, MetricCounts> = {
      movie: { month: 0, year: 0, total: 0 },
      series: { month: 0, year: 0, total: 0 },
      anime: { month: 0, year: 0, total: 0 },
      manga: { month: 0, year: 0, total: 0 },
      game: { month: 0, year: 0, total: 0 },
    };

    for (const entry of completedEntries) {
      base[entry.mediaType].total += 1;

      const completedAtMs = entry.completedAtMs;
      if (!completedAtMs) continue;
      if (completedAtMs > nowMs) continue;

      if (completedAtMs >= startYearMs) base[entry.mediaType].year += 1;
      if (completedAtMs >= startMonthMs) base[entry.mediaType].month += 1;
    }

    return base;
  }, [completedEntries]);

  const totalsForHero = useMemo(
    () => ({
      movies: metricsByType.movie.total,
      series: metricsByType.series.total,
      anime: metricsByType.anime.total,
      manga: metricsByType.manga.total,
      games: metricsByType.game.total,
    }),
    [metricsByType],
  );

  const recentByType = useMemo(() => {
    const grouped: Record<EntryMediaType, EntryDoc[]> = {
      movie: [],
      series: [],
      anime: [],
      manga: [],
      game: [],
    };

    for (const entry of entries) {
      grouped[entry.mediaType].push(entry);
    }

    const sortKey = (e: EntryDoc) => e.completedAtMs ?? e.createdAtMs ?? 0;
    (Object.keys(grouped) as EntryMediaType[]).forEach((key) => {
      grouped[key].sort((a, b) => sortKey(b) - sortKey(a));
    });

    return grouped;
  }, [entries]);

  const username = user?.displayName || user?.email || "Traveler";
  const visibleEntriesError = uid ? error : null;

  return (
    <div className="flex flex-col gap-10 pb-20">
      <Hero username={username} stats={totalsForHero} />

      <section className="w-full px-4 md:px-8">
        <div className="flex items-end justify-between gap-6">
          {!uid && <div className="text-sm text-neutral-500">Sign in to start tracking.</div>}
        </div>
        {uid && status === "loading" ? (
          <div className="mt-3 text-sm text-neutral-500">Syncing…</div>
        ) : null}
        {visibleEntriesError ? (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-red-400">
            <div className="min-w-0 flex-1 truncate">{visibleEntriesError}</div>
            <button
              type="button"
              onClick={onRetry}
              className="shrink-0 rounded-full border border-white/10 bg-neutral-900/40 px-3 py-1 text-xs text-neutral-200 transition-colors hover:bg-neutral-900/70"
            >
              Retry
            </button>
          </div>
        ) : null}

        <div className="mt-6 grid not-sm:grid-cols-1 grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {(Object.keys(contentTypeLabels) as EntryMediaType[]).map((type) => (
            <GlassCard key={type} className="p-5" hoverEffect>
              <div className="text-sm font-semibold text-white">{contentTypeLabels[type]}</div>
              <div className="mt-4 space-y-3">
                {metricLabels.map(({ key, label }) => (
                  <div key={key} className="flex items-baseline justify-between gap-4">
                    <div className="text-xs font-medium text-neutral-500">{label}</div>
                    <div className="text-2xl font-bold text-white tabular-nums">
                      {metricsByType[type][key].toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          ))}
        </div>
      </section>

      <section className="w-full px-4 md:px-8">
        <h2 className="text-xl font-semibold text-white">Recent activity</h2>
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {(Object.keys(contentTypeLabels) as EntryMediaType[]).map((type) => {
            const items = recentByType[type].slice(0, 10);

            return (
              <GlassCard key={type} className="p-5" hoverEffect>
                <div className="text-sm font-semibold text-white">{contentTypeLabels[type]}</div>

                {uid && items.length === 0 ? (
                  <div className="mt-4 text-sm text-neutral-400">No recent activity</div>
                ) : null}

                {!uid ? (
                  <div className="mt-4 text-sm text-neutral-500">
                    Sign in to see your recent activity.
                  </div>
                ) : null}

                {items.length > 0 ? (
                  <div className="mt-4 space-y-3 max-h-85 overflow-y-auto pr-2">
                    {items.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center gap-3 rounded-2xl border border-white/5 bg-neutral-900/40 p-3"
                      >
                        <div className="h-14 w-10 shrink-0 overflow-hidden rounded-lg bg-neutral-800/50">
                          {entry.image ? (
                            <Image
                              src={entry.image}
                              alt={entry.title}
                              width={40}
                              height={56}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full bg-neutral-800/50" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold text-white">
                              {entry.title}
                            </span>
                            <span
                              className={cn(
                                "shrink-0 rounded-full border px-2 py-0.5 text-[10px]",
                                entry.mediaType === "game"
                                  ? {
                                      "border-emerald-700/20 bg-emerald-700/10 text-emerald-600":
                                        entry.status === "main_story_completed",
                                      "border-emerald-400/20 bg-emerald-400/10 text-emerald-300":
                                        entry.status === "fully_completed",
                                      "border-amber-500/20 bg-amber-500/10 text-amber-400":
                                        entry.status === "backlogged",
                                      "border-orange-500/20 bg-orange-500/10 text-orange-400":
                                        entry.status === "bored",
                                      "border-pink-500/20 bg-pink-500/10 text-pink-400":
                                        entry.status === "own",
                                      "border-white/20 bg-white/10 text-white":
                                        entry.status === "wishlist",
                                      "border-sky-500/20 bg-sky-500/10 text-sky-400":
                                        entry.status === "committed",
                                      "border-blue-700/20 bg-blue-700/10 text-blue-500":
                                        entry.status === "not_committed",
                                      "border-red-500/20 bg-red-500/10 text-red-400":
                                        entry.status === "dropped",
                                      "border-neutral-500/20 bg-neutral-800/40 text-neutral-400":
                                        entry.status === "unspecified",
                                    }
                                  : {
                                      "border-violet-500/20 bg-violet-500/10 text-violet-400":
                                        entry.status === "plan_to_watch",
                                      "border-blue-500/20 bg-blue-500/10 text-blue-400":
                                        entry.status === "watching",
                                      "border-emerald-500/20 bg-emerald-500/10 text-emerald-400":
                                        entry.status === "completed",
                                      "border-amber-500/20 bg-amber-500/10 text-amber-400":
                                        entry.status === "on_hold",
                                      "border-red-500/20 bg-red-500/10 text-red-400":
                                        entry.status === "dropped",
                                      "border-neutral-500/20 bg-neutral-800/40 text-neutral-400":
                                        entry.status === "unspecified",
                                    },
                              )}
                            >
                              {entryStatusLabels[entry.status] ?? "Unspecified"}
                            </span>
                          </div>
                          {entry.releaseYear || entry.completedAtMs ? (
                            <div className="mt-1 text-xs text-neutral-500">
                              {entry.releaseYear ? `${entry.releaseYear}` : ""}
                              {entry.releaseYear && entry.completedAtMs ? " • " : ""}
                              {entry.completedAtMs ? formatISODate(entry.completedAtMs) : ""}
                            </div>
                          ) : null}
                        </div>
                        {typeof entry.userRating === "number" ? (
                          <div className="flex items-center gap-1 shrink-0 rounded-full border border-white/10 bg-neutral-800/40 px-2.5 py-1 text-xs text-neutral-200 tabular-nums">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            {entry.userRating.toFixed(1)}
                          </div>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => onSelectEntry(entry)}
                          className="shrink-0 rounded-full border border-white/10 bg-neutral-800/40 px-3 py-1 text-xs text-neutral-200 hover:bg-neutral-800/70 transition-colors"
                        >
                          View
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </GlassCard>
            );
          })}
        </div>
      </section>
    </div>
  );
}
