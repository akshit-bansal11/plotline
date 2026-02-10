"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { collection, limit, onSnapshot, orderBy, query, deleteDoc, doc } from "firebase/firestore";
import { AnimatePresence, motion } from "motion/react";
import { Hero } from "@/components/content/hero";
import { GlassCard } from "@/components/ui/glass-card";
import { Modal } from "@/components/ui/modal";
import { MediaGrid } from "@/components/content/media-grid";
import { MediaSection } from "@/components/content/media-section";
import { useAuth } from "@/context/auth-context";
import { useSection, type SectionKey } from "@/context/section-context";
import { db } from "@/lib/firebase";
import { LogEntryModal } from "@/components/entry/log-entry-modal";

type EntryMediaType = "movie" | "series" | "anime" | "anime_movie" | "manga" | "game";
type EntryStatus = "watching" | "completed" | "plan_to_watch" | "dropped";

type EntryDoc = {
  id: string;
  title: string;
  mediaType: EntryMediaType;
  status: EntryStatus;
  rating: number | null;
  notes: string;
  description: string;
  image: string | null;
  year: string | null;
  lengthMinutes: number | null;
  episodeCount: number | null;
  chapterCount: number | null;
  createdAtMs: number | null;
  completedAtMs: number | null;
  completionDateUnknown: boolean;
  genresThemes: string[];
};

const statusLabels: Record<EntryStatus, string> = {
  watching: "Watching",
  completed: "Completed",
  plan_to_watch: "Plan to watch",
  dropped: "Dropped",
};

const mediaTypeLabels: Record<EntryMediaType, string> = {
  movie: "Movie",
  series: "Series",
  anime: "Anime",
  anime_movie: "Anime movie",
  manga: "Manga",
  game: "Game",
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

const toNumber = (value: unknown): number | null => {
  if (typeof value !== "number") return null;
  return Number.isFinite(value) ? value : null;
};

const formatDate = (value: number | null) => {
  if (!value) return "";
  return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
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

// Removed normalizeSection here as it is imported from context or handled by it.
// Actually we need SectionKey type which is imported.


type EntriesStatus = "idle" | "loading" | "ready" | "error";
type EntriesStore = {
  uid: string | null;
  entries: EntryDoc[];
  status: EntriesStatus;
  error: string | null;
  updatedAt: number | null;
  token: number;
};

const entriesCache = new Map<string, { entries: EntryDoc[]; updatedAt: number }>();

const coerceMediaType = (value: unknown): EntryMediaType => {
  if (value === "movie" || value === "series" || value === "anime" || value === "anime_movie" || value === "manga" || value === "game") return value;
  return "movie";
};

const coerceStatus = (value: unknown): EntryStatus => {
  if (value === "watching" || value === "completed" || value === "plan_to_watch" || value === "dropped") return value;
  return "watching";
};

const parseEntry = (id: string, raw: Record<string, unknown>): EntryDoc => {
  const genresThemes = Array.isArray(raw.genresThemes) ? raw.genresThemes.filter((v): v is string => typeof v === "string") : [];
  return {
    id,
    title: String(raw.title || ""),
    mediaType: coerceMediaType(raw.mediaType),
    status: coerceStatus(raw.status),
    rating: typeof raw.rating === "number" ? raw.rating : null,
    notes: String(raw.notes || ""),
    description: String(raw.description || ""),
    image: raw.image ? String(raw.image) : null,
    year: raw.year ? String(raw.year) : null,
    lengthMinutes: toNumber(raw.lengthMinutes),
    episodeCount: toNumber(raw.episodeCount),
    chapterCount: toNumber(raw.chapterCount),
    createdAtMs: toMillis(raw.createdAt),
    completedAtMs: toMillis(raw.completedAt),
    completionDateUnknown: Boolean(raw.completionDateUnknown),
    genresThemes,
  };
};

function EntryDetailModal({ entry, onClose }: { entry: EntryDoc | null; onClose: () => void }) {
  if (!entry) return null;
  const subtitle = [entry.year, mediaTypeLabels[entry.mediaType], statusLabels[entry.status]].filter(Boolean).join(" • ");
  const completionValue =
    entry.status === "completed"
      ? entry.completionDateUnknown
        ? "Unknown"
        : formatDate(entry.completedAtMs)
      : "";

  return (
    <Modal isOpen={Boolean(entry)} onClose={onClose} title="Item details" className="max-w-4xl bg-neutral-900/60">
      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="w-full sm:w-48">
          <div className="aspect-[2/3] w-full overflow-hidden rounded-2xl bg-neutral-800/50">
            {entry.image ? (
              <Image src={entry.image} alt={entry.title} width={192} height={288} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-neutral-800/50" />
            )}
          </div>
        </div>
        <div className="flex-1 space-y-4">
          <div className="space-y-1">
            <div className="text-xl font-semibold text-white">{entry.title || "Untitled"}</div>
            {subtitle ? <div className="text-sm text-neutral-400">{subtitle}</div> : null}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {entry.rating !== null ? (
              <div className="rounded-xl border border-white/5 bg-neutral-900/40 px-3 py-2 text-xs text-neutral-300">
                Rating: {entry.rating}/10
              </div>
            ) : null}
            {entry.lengthMinutes !== null ? (
              <div className="rounded-xl border border-white/5 bg-neutral-900/40 px-3 py-2 text-xs text-neutral-300">
                Length: {entry.lengthMinutes} min
              </div>
            ) : null}
            {entry.episodeCount !== null ? (
              <div className="rounded-xl border border-white/5 bg-neutral-900/40 px-3 py-2 text-xs text-neutral-300">
                Episodes: {entry.episodeCount}
              </div>
            ) : null}
            {entry.chapterCount !== null ? (
              <div className="rounded-xl border border-white/5 bg-neutral-900/40 px-3 py-2 text-xs text-neutral-300">
                Chapters: {entry.chapterCount}
              </div>
            ) : null}
            {completionValue ? (
              <div className="rounded-xl border border-white/5 bg-neutral-900/40 px-3 py-2 text-xs text-neutral-300">
                Completed: {completionValue}
              </div>
            ) : null}
            {entry.createdAtMs ? (
              <div className="rounded-xl border border-white/5 bg-neutral-900/40 px-3 py-2 text-xs text-neutral-300">
                Logged: {formatDate(entry.createdAtMs)}
              </div>
            ) : null}
          </div>
          {entry.description ? <div className="text-sm text-neutral-300 whitespace-pre-line">{entry.description}</div> : null}
          {entry.genresThemes.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {entry.genresThemes.map((tag) => (
                <span key={tag} className="rounded-full border border-white/10 bg-neutral-800/50 px-2 py-1 text-xs text-neutral-200">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}

const useEntriesStore = (uid: string | null, reloadToken: number): EntriesStore => {
  const cached = uid ? entriesCache.get(uid) : null;
  const [store, setStore] = useState<EntriesStore>(() => {
    if (!uid) return { uid: null, entries: [], status: "idle", error: null, updatedAt: null, token: reloadToken };
    if (cached) return { uid, entries: cached.entries, status: "ready", error: null, updatedAt: cached.updatedAt, token: reloadToken };
    return { uid, entries: [], status: "loading", error: null, updatedAt: null, token: reloadToken };
  });

  useEffect(() => {
    if (!uid) return;
    const entriesQuery = query(collection(db, "users", uid, "entries"), orderBy("createdAt", "desc"), limit(1000));
    const unsubscribe = onSnapshot(
      entriesQuery,
      (snapshot) => {
        const next = snapshot.docs.map((docSnap) => parseEntry(docSnap.id, docSnap.data() as Record<string, unknown>));
        const updatedAt = Date.now();
        entriesCache.set(uid, { entries: next, updatedAt });
        setStore({ uid, entries: next, status: "ready", error: null, updatedAt, token: reloadToken });
      },
      (err) => {
        const message = err instanceof Error ? err.message : "Failed to sync entries.";
        setStore((prev) => ({ ...prev, uid, status: "error", error: message, token: reloadToken }));
      }
    );

    return () => unsubscribe();
  }, [reloadToken, uid]);

  if (!uid) return { uid: null, entries: [], status: "idle", error: null, updatedAt: null, token: reloadToken };

  const cachedNow = entriesCache.get(uid) || null;
  const retrying = store.uid === uid && store.status === "error" && store.token !== reloadToken;
  if (retrying) {
    if (cachedNow) return { uid, entries: cachedNow.entries, status: "ready", error: null, updatedAt: cachedNow.updatedAt, token: reloadToken };
    return { uid, entries: store.entries, status: "loading", error: null, updatedAt: store.updatedAt, token: reloadToken };
  }

  if (store.uid === uid) {
    if (store.status === "loading" && cachedNow) return { uid, entries: cachedNow.entries, status: "ready", error: null, updatedAt: cachedNow.updatedAt, token: store.token };
    return store;
  }

  if (cachedNow) return { uid, entries: cachedNow.entries, status: "ready", error: null, updatedAt: cachedNow.updatedAt, token: reloadToken };
  return { uid, entries: [], status: "loading", error: null, updatedAt: null, token: reloadToken };
};

function DashboardSection({
  entries,
  status,
  error,
  onRetry,
  onSelectEntry,
}: {
  entries: EntryDoc[];
  status: EntriesStatus;
  error: string | null;
  onRetry: () => void;
  onSelectEntry: (entry: EntryDoc) => void;
}) {
  const { user } = useAuth();
  const uid = user?.uid || null;

  const completedEntries = useMemo(() => entries.filter((e) => e.status === "completed"), [entries]);

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
  const visibleEntriesError = uid ? error : null;

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
        {uid && status === "loading" ? <div className="mt-3 text-sm text-neutral-500">Syncing…</div> : null}
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

                {uid && items.length === 0 ? <div className="mt-4 text-sm text-neutral-400">No completed items yet.</div> : null}

                {!uid ? <div className="mt-4 text-sm text-neutral-500">Sign in to see your recent activity.</div> : null}

                {items.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {items.map((entry) => (
                      <div key={entry.id} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-neutral-900/40 p-3">
                        <div className="h-14 w-10 shrink-0 overflow-hidden rounded-lg bg-neutral-800/50">
                          {entry.image ? (
                            <Image src={entry.image} alt={entry.title} width={40} height={56} className="h-full w-full object-cover" />
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

function LibrarySection({
  title,
  description,
  mediaTypes,
  gridType,
  filterRaw,
  onFilterRawChange,
  entries,
  status,
  error,
  onRetry,
  onSelectEntry,
  onEditEntry,
  onDeleteEntry,
}: {
  title: string;
  description: string;
  mediaTypes: string[];
  gridType: string;
  filterRaw: string;
  onFilterRawChange: (next: string) => void;
  entries: EntryDoc[];
  status: EntriesStatus;
  error: string | null;
  onRetry: () => void;
  onSelectEntry: (entry: EntryDoc) => void;
  onEditEntry: (entry: EntryDoc) => void;
  onDeleteEntry: (entry: EntryDoc) => void;
}) {
  const { user } = useAuth();
  const uid = user?.uid || null;


  const sectionEntries = useMemo(() => {
    return entries.filter((entry) => mediaTypes.includes(entry.mediaType));
  }, [entries, mediaTypes]);

  const visibleEntriesError = uid ? error : null;

  return (
    <div className="pt-12">
      <div className="container mx-auto px-4 md:px-6">
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">{title}</h1>
        <p className="text-neutral-400">{description}</p>
      </div>

      {!uid ? (
        <div className="container mx-auto px-4 md:px-6 text-sm text-neutral-500">Sign in to see your library.</div>
      ) : (
        <>
          {uid && status === "loading" && entries.length === 0 ? <div className="container mx-auto px-4 md:px-6 text-sm text-neutral-400">Loading…</div> : null}
          {visibleEntriesError ? (
            <div className="container mx-auto px-4 md:px-6 flex flex-wrap items-center gap-3 text-sm text-red-400">
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
          <MediaSection
            items={sectionEntries}
            getGenresThemes={(entry) => entry.genresThemes}
            title="Results"
            filterRaw={filterRaw}
            onFilterRawChange={onFilterRawChange}
          >
            {(filteredEntries) =>
              filteredEntries.length === 0 ? (
                <div className="text-sm text-neutral-400">No items found.</div>
              ) : (
                <MediaGrid
                  items={filteredEntries.map((entry) => ({
                    id: entry.id,
                    title: entry.title,
                    image: entry.image,
                    year: entry.year || undefined,
                    type: gridType,
                    onClick: () => onSelectEntry(entry),
                    showActions: true,
                    onView: () => onSelectEntry(entry),
                    onEdit: () => onEditEntry(entry),
                    onDelete: () => onDeleteEntry(entry),
                  }))}
                />
              )
            }
          </MediaSection>
        </>
      )}
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const uid = user?.uid || null;
  const { activeSection } = useSection();
  const [selectedEntry, setSelectedEntry] = useState<EntryDoc | null>(null);
  const [libraryFilters, setLibraryFilters] = useState<Record<Exclude<SectionKey, "home">, string>>({
    movies: "",
    series: "",
    anime: "",
    manga: "",
    games: "",
  });
  const [entriesReloadToken, setEntriesReloadToken] = useState(0);
  const [isEditingEntry, setIsEditingEntry] = useState<EntryDoc | null>(null);

  const handleEditEntry = (entry: EntryDoc) => {
    setIsEditingEntry(entry);
  };

  const handleDeleteEntry = async (entry: EntryDoc) => {
    if (!uid) return;
    
    if (!confirm(`Are you sure you want to delete "${entry.title}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, "users", uid, "entries", entry.id));
      // The entry will be automatically removed from the UI due to the real-time listener
    } catch (error) {
      console.error("Error deleting entry:", error);
      alert("Failed to delete entry. Please try again.");
    }
  };
  const entriesStore = useEntriesStore(uid, entriesReloadToken);

  const retrySync = () => setEntriesReloadToken((prev) => prev + 1);

  // No internal hash listener needed anymore, handled by SectionProvider

  const sectionNode =
    activeSection === "home" ? (
      <DashboardSection
        entries={entriesStore.entries}
        status={entriesStore.status}
        error={entriesStore.error}
        onRetry={retrySync}
        onSelectEntry={setSelectedEntry}
      />
    ) : activeSection === "movies" ? (
      <LibrarySection
        title="Movies"
        description="Your logged movies."
        mediaTypes={["movie"]}
        gridType="movie"
        filterRaw={libraryFilters.movies}
        onFilterRawChange={(next) => setLibraryFilters((prev) => ({ ...prev, movies: next }))}
        entries={entriesStore.entries}
        status={entriesStore.status}
        error={entriesStore.error}
        onRetry={retrySync}
        onSelectEntry={setSelectedEntry}
        onEditEntry={handleEditEntry}
        onDeleteEntry={handleDeleteEntry}
      />
    ) : activeSection === "series" ? (
      <LibrarySection
        title="Series"
        description="Your logged series."
        mediaTypes={["series"]}
        gridType="series"
        filterRaw={libraryFilters.series}
        onFilterRawChange={(next) => setLibraryFilters((prev) => ({ ...prev, series: next }))}
        entries={entriesStore.entries}
        status={entriesStore.status}
        error={entriesStore.error}
        onRetry={retrySync}
        onSelectEntry={setSelectedEntry}
        onEditEntry={handleEditEntry}
        onDeleteEntry={handleDeleteEntry}
      />
    ) : activeSection === "anime" ? (
      <LibrarySection
        title="Anime"
        description="Your logged anime."
        mediaTypes={["anime", "anime_movie"]}
        gridType="anime"
        filterRaw={libraryFilters.anime}
        onFilterRawChange={(next) => setLibraryFilters((prev) => ({ ...prev, anime: next }))}
        entries={entriesStore.entries}
        status={entriesStore.status}
        error={entriesStore.error}
        onRetry={retrySync}
        onSelectEntry={setSelectedEntry}
        onEditEntry={handleEditEntry}
        onDeleteEntry={handleDeleteEntry}
      />
    ) : activeSection === "manga" ? (
      <LibrarySection
        title="Manga"
        description="Your logged manga."
        mediaTypes={["manga"]}
        gridType="manga"
        filterRaw={libraryFilters.manga}
        onFilterRawChange={(next) => setLibraryFilters((prev) => ({ ...prev, manga: next }))}
        entries={entriesStore.entries}
        status={entriesStore.status}
        error={entriesStore.error}
        onRetry={retrySync}
        onSelectEntry={setSelectedEntry}
        onEditEntry={handleEditEntry}
        onDeleteEntry={handleDeleteEntry}
      />
    ) : (
      <LibrarySection
        title="Games"
        description="Your logged games."
        mediaTypes={["game"]}
        gridType="game"
        filterRaw={libraryFilters.games}
        onFilterRawChange={(next) => setLibraryFilters((prev) => ({ ...prev, games: next }))}
        entries={entriesStore.entries}
        status={entriesStore.status}
        error={entriesStore.error}
        onRetry={retrySync}
        onSelectEntry={setSelectedEntry}
        onEditEntry={handleEditEntry}
        onDeleteEntry={handleDeleteEntry}
      />
    );

  return (
    <>
      <AnimatePresence mode="sync" initial={false}>
        <motion.div
          key={activeSection}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.14 }}
          className="w-full"
        >
          {sectionNode}
        </motion.div>
      </AnimatePresence>
      <EntryDetailModal entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
      <LogEntryModal
        isOpen={!!isEditingEntry}
        onClose={() => setIsEditingEntry(null)}
        initialMedia={isEditingEntry ? {
          id: isEditingEntry.id,
          title: isEditingEntry.title,
          image: isEditingEntry.image,
          year: isEditingEntry.year || undefined,
          type: isEditingEntry.mediaType === "anime_movie" ? "movie" : isEditingEntry.mediaType,
        } : null}
      />
    </>
  );
}
