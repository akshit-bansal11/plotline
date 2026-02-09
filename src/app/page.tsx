"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { Hero } from "@/components/content/hero";
import { GlassCard } from "@/components/ui/glass-card";
import { useAuth } from "@/context/auth-context";
import { db } from "@/lib/firebase";

type EntryMediaType = "movie" | "series" | "anime" | "anime_movie" | "manga" | "game";
type EntryStatus = "watching" | "completed" | "plan_to_watch" | "dropped";

type EntryDoc = {
  id: string;
  title: string;
  mediaType: EntryMediaType;
  status: EntryStatus;
  rating: number | null;
  notes: string;
  source: string | null;
  image: string | null;
  year: string | null;
  createdAtMs: number | null;
  completedAtMs: number | null;
  completionDateUnknown: boolean;
};

const toMillis = (value: unknown): number | null => {
  if (!value) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "object" && value && "toMillis" in value && typeof (value as { toMillis?: unknown }).toMillis === "function") {
    const millis = (value as { toMillis: () => number }).toMillis();
    return typeof millis === "number" && Number.isFinite(millis) ? millis : null;
  }
  return null;
};

const formatISODate = (millis: number) => {
  const date = new Date(millis);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

type MetricCounts = { month: number; year: number; total: number };

const metricLabels: Array<{ key: keyof MetricCounts; label: string }> = [
  { key: "month", label: "This month" },
  { key: "year", label: "This year" },
  { key: "total", label: "All time" },
];

const contentTypeLabels: Record<EntryMediaType, string> = {
  movie: "Movies",
  series: "Series",
  anime: "Anime",
  anime_movie: "Anime movies",
  manga: "Manga",
  game: "Games",
};

export default function Home() {
  const { user } = useAuth();
  const uid = user?.uid || null;

  const [entriesState, setEntriesState] = useState<{ uid: string | null; entries: EntryDoc[] }>({ uid: null, entries: [] });
  const [entriesError, setEntriesError] = useState<{ uid: string; message: string } | null>(null);

  useEffect(() => {
    if (!uid) return;

    const entriesQuery = query(collection(db, "users", uid, "entries"), orderBy("createdAt", "desc"), limit(1000));
    const unsubscribe = onSnapshot(
      entriesQuery,
      (snapshot) => {
        const next: EntryDoc[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as Partial<EntryDoc> & {
            createdAt?: unknown;
            completedAt?: unknown;
            completionDateUnknown?: unknown;
          };

          const mediaType =
            data.mediaType === "movie" ||
            data.mediaType === "series" ||
            data.mediaType === "anime" ||
            data.mediaType === "anime_movie" ||
            data.mediaType === "manga" ||
            data.mediaType === "game"
              ? data.mediaType
              : "movie";

          const status =
            data.status === "watching" || data.status === "completed" || data.status === "plan_to_watch" || data.status === "dropped"
              ? data.status
              : "watching";

          return {
            id: docSnap.id,
            title: String(data.title || ""),
            mediaType,
            status,
            rating: typeof data.rating === "number" ? data.rating : null,
            notes: String(data.notes || ""),
            source: data.source ? String(data.source) : null,
            image: data.image ? String(data.image) : null,
            year: data.year ? String(data.year) : null,
            createdAtMs: toMillis(data.createdAt),
            completedAtMs: toMillis(data.completedAt),
            completionDateUnknown: Boolean(data.completionDateUnknown),
          };
        });
        setEntriesState({ uid, entries: next });
        setEntriesError(null);
      },
      (err) => {
        setEntriesState({ uid, entries: [] });
        const message = err instanceof Error ? err.message : "Failed to load entries.";
        setEntriesError({ uid, message });
      }
    );

    return () => unsubscribe();
  }, [uid]);

  const visibleEntries = useMemo(
    () => (uid && entriesState.uid === uid ? entriesState.entries : []),
    [entriesState, uid]
  );
  const completedEntries = useMemo(() => visibleEntries.filter((e) => e.status === "completed"), [visibleEntries]);

  const metricsByType = useMemo(() => {
    const now = new Date();
    const nowMs = now.getTime();
    const startMonthMs = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const startYearMs = new Date(now.getFullYear(), 0, 1).getTime();

    const base: Record<EntryMediaType, MetricCounts> = {
      movie: { month: 0, year: 0, total: 0 },
      series: { month: 0, year: 0, total: 0 },
      anime: { month: 0, year: 0, total: 0 },
      anime_movie: { month: 0, year: 0, total: 0 },
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
      anime: metricsByType.anime.total + metricsByType.anime_movie.total,
      manga: metricsByType.manga.total,
      games: metricsByType.game.total,
    }),
    [metricsByType]
  );

  const recentByType = useMemo(() => {
    const grouped: Record<EntryMediaType, EntryDoc[]> = { movie: [], series: [], anime: [], anime_movie: [], manga: [], game: [] };
    for (const entry of completedEntries) grouped[entry.mediaType].push(entry);

    const sortKey = (e: EntryDoc) => e.completedAtMs ?? e.createdAtMs ?? 0;
    (Object.keys(grouped) as EntryMediaType[]).forEach((key) => grouped[key].sort((a, b) => sortKey(b) - sortKey(a)));

    return grouped;
  }, [completedEntries]);

  const username = user?.displayName || user?.email || "Traveler";
  const visibleEntriesError = uid && entriesError?.uid === uid ? entriesError.message : null;

  return (
    <div className="flex flex-col gap-10 pb-20">
      <Hero username={username} stats={totalsForHero} />

      <section className="container mx-auto px-4 md:px-6">
        <div className="flex items-end justify-between gap-6">
          <div>
            <h2 className="text-xl font-semibold text-white">Dashboard</h2>
            <div className="mt-1 text-sm text-neutral-400">Metrics update instantly based on your completion dates.</div>
          </div>
          {!uid && <div className="text-sm text-neutral-500">Sign in to start tracking.</div>}
        </div>
        {visibleEntriesError ? <div className="mt-3 text-sm text-red-400">{visibleEntriesError}</div> : null}

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
          {(Object.keys(contentTypeLabels) as EntryMediaType[]).map((type) => (
            <GlassCard key={type} className="p-5" hoverEffect>
              <div className="text-sm font-semibold text-white">{contentTypeLabels[type]}</div>
              <div className="mt-4 space-y-3">
                {metricLabels.map(({ key, label }) => (
                  <div key={key} className="flex items-baseline justify-between gap-4">
                    <div className="text-xs font-medium text-neutral-500">{label}</div>
                    <div className="text-2xl font-bold text-white tabular-nums">{metricsByType[type][key].toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </GlassCard>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 md:px-6">
        <h2 className="text-xl font-semibold text-white">Recent activity</h2>
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {(Object.keys(contentTypeLabels) as EntryMediaType[]).map((type) => {
            const items = recentByType[type].slice(0, 5);
            return (
              <GlassCard key={type} className="p-5" hoverEffect>
                <div className="flex items-center justify-between gap-4">
                  <div className="text-sm font-semibold text-white">{contentTypeLabels[type]}</div>
                  <div className="text-xs text-neutral-500">Most recently completed</div>
                </div>

                {uid && items.length === 0 ? (
                  <div className="mt-4 text-sm text-neutral-400">No completed items yet.</div>
                ) : null}

                {!uid ? (
                  <div className="mt-4 text-sm text-neutral-500">Sign in to see your recent activity.</div>
                ) : null}

                {items.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {items.map((entry) => (
                      <div key={entry.id} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-neutral-900/40 p-3">
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
                          <div className="truncate text-sm font-semibold text-white">{entry.title}</div>
                          <div className="mt-1 text-xs text-neutral-500">
                            {entry.year ? `${entry.year} • ` : ""}
                            {entry.completedAtMs
                              ? formatISODate(entry.completedAtMs)
                              : entry.completionDateUnknown
                                ? "Date unknown"
                                : "No date set"}
                          </div>
                        </div>
                        {typeof entry.rating === "number" ? (
                          <div className="shrink-0 rounded-full border border-white/10 bg-neutral-800/40 px-3 py-1 text-xs text-neutral-200 tabular-nums">
                            {entry.rating.toFixed(1)}
                          </div>
                        ) : null}
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
