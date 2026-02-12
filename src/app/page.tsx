"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { collection, deleteDoc, doc, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Hero } from "@/components/content/hero";
import { GlassCard } from "@/components/ui/glass-card";
import { MediaGrid } from "@/components/content/media-grid";
import { MediaSection } from "@/components/content/media-section";
import { useAuth } from "@/context/auth-context";
import { useSection, type SectionKey } from "@/context/section-context";
import { useData, type EntryDoc, type EntryMediaType, type EntryStatus } from "@/context/data-context";
import { db } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import { LogEntryModal } from "@/components/entry/log-entry-modal";
import { EntryDetailModal } from "@/components/entry/entry-detail-modal";
import { MyListsModal } from "@/components/lists/my-lists-modal";

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

type ListRow = {
  id: string;
  name: string;
  description: string;
  type: EntryMediaType;
};

type ListItemRow = {
  id: string;
  title: string;
  mediaType: EntryMediaType;
  externalId: string;
  image: string | null;
  year: string | null;
};

type ListModalType = Exclude<EntryMediaType, "anime_movie">;

const coerceListType = (value: unknown): EntryMediaType => {
  if (value === "movie" || value === "series" || value === "anime" || value === "manga" || value === "game" || value === "anime_movie") {
    return value;
  }
  return "movie";
};

function DashboardSection({
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
                            {entry.releaseYear ? `${entry.releaseYear} • ` : ""}
                            {entry.completedAtMs
                              ? formatISODate(entry.completedAtMs)
                              : entry.completionDateUnknown
                                ? "Date unknown"
                                : "No date set"}
                          </div>
                        </div>
                        {typeof entry.userRating === "number" ? (
                          <div className="shrink-0 rounded-full border border-white/10 bg-neutral-800/40 px-3 py-1 text-xs text-neutral-200 tabular-nums">
                            You {entry.userRating.toFixed(1)}
                          </div>
                        ) : typeof entry.imdbRating === "number" ? (
                          <div className="shrink-0 rounded-full border border-white/10 bg-neutral-800/40 px-3 py-1 text-xs text-neutral-200 tabular-nums">
                            IMDb {entry.imdbRating.toFixed(1)}
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
  onEditList,
  onDeleteList,
}: {
  title: string;
  description: string;
  mediaTypes: string[];
  gridType: string;
  filterRaw: string;
  onFilterRawChange: (next: string) => void;
  entries: EntryDoc[];
  status: string;
  error: string | null;
  onRetry: () => void;
  onSelectEntry: (entry: EntryDoc) => void;
  onEditEntry: (entry: EntryDoc) => void;
  onDeleteEntry: (entry: EntryDoc) => void;
  onEditList: (list: ListRow) => void;
  onDeleteList: (list: ListRow) => void;
}) {
  const { user } = useAuth();
  const uid = user?.uid || null;
  const [lists, setLists] = useState<ListRow[]>([]);
  const [listItemsById, setListItemsById] = useState<Record<string, ListItemRow[]>>({});
  const [openLists, setOpenLists] = useState<Record<string, boolean>>({});

  const sectionEntries = useMemo(() => {
    return entries.filter((entry) => mediaTypes.includes(entry.mediaType));
  }, [entries, mediaTypes]);

  const mediaTypeSet = useMemo(() => {
    const normalized = mediaTypes.map((type) => (type === "anime_movie" ? "anime" : type));
    return new Set(normalized);
  }, [mediaTypes]);

  useEffect(() => {
    if (!uid) return;

    const listsQuery = query(collection(db, "users", uid, "lists"), orderBy("updatedAt", "desc"), limit(50));
    const unsubscribe = onSnapshot(listsQuery, (snapshot) => {
      const nextLists = snapshot.docs.map((snap) => {
        const data = snap.data() as { name?: unknown; description?: unknown; type?: unknown };
        return {
          id: snap.id,
          name: typeof data.name === "string" ? data.name : "",
          description: typeof data.description === "string" ? data.description : "",
          type: coerceListType(data.type),
        };
      });
      const filteredLists = nextLists.filter((list) => mediaTypeSet.has(list.type));
      setLists(filteredLists);
      setOpenLists((prev) => {
        const next = { ...prev };
        filteredLists.forEach((list) => {
          if (next[list.id] === undefined) next[list.id] = true;
        });
        return next;
      });
    });

    return () => unsubscribe();
  }, [mediaTypeSet, uid]);

  useEffect(() => {
    if (!uid || lists.length === 0) return;

    const unsubscribers = lists.map((list) => {
      const itemsQuery = query(
        collection(db, "users", uid, "lists", list.id, "items"),
        orderBy("addedAt", "desc"),
        limit(500),
      );
      return onSnapshot(itemsQuery, (snapshot) => {
        const nextItems = snapshot.docs.map((snap) => {
          const data = snap.data() as Partial<ListItemRow> & { mediaType?: unknown; externalId?: unknown; image?: unknown; year?: unknown; title?: unknown };
          return {
            id: snap.id,
            title: typeof data.title === "string" ? data.title : "",
            mediaType: coerceListType(data.mediaType),
            externalId: typeof data.externalId === "string" ? data.externalId : "",
            image: data.image ? String(data.image) : null,
            year: data.year ? String(data.year) : null,
          };
        });
        setListItemsById((prev) => ({ ...prev, [list.id]: nextItems }));
      });
    });

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [lists, uid]);

 

  const visibleEntriesError = uid ? error : null;

  return (
    <div className="pt-12">
      <div className="container mx-auto px-4 md:px-6 mb-4">
        <h1 className="text-3xl font-bold tracking-tight text-white">{title}</h1>
        <p className="text-neutral-400 text-sm">{description}</p>
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
            getFilterValues={(entry) => [
              entry.releaseYear,
              entry.userRating,
              entry.imdbRating,
            ]}
            title="Results"
            filterRaw={filterRaw}
            onFilterRawChange={onFilterRawChange}
          >
            {(filteredEntries) => {
              const filteredById = new Map(filteredEntries.map((entry) => [entry.id, entry]));
              const listedIds = new Set<string>();

              const listSections = lists.map((list) => {
                const listItems = listItemsById[list.id] || [];
                const listEntries = listItems
                  .map((item) => filteredById.get(item.externalId))
                  .filter((entry): entry is EntryDoc => Boolean(entry));
                listEntries.forEach((entry) => listedIds.add(entry.id));
                const isOpen = openLists[list.id] ?? true;

                return (
                  <div key={list.id} className="space-y-3">
                    <div className="flex w-full items-center justify-between rounded-xl border border-white/5 bg-neutral-900/40 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-900/60">
                      <button
                        type="button"
                        onClick={() => setOpenLists((prev) => ({ ...prev, [list.id]: !isOpen }))}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        aria-label={isOpen ? "Collapse list" : "Expand list"}
                      >
                        <div className="p-1.5 rounded-full bg-white/5">
                          {isOpen ? <ChevronDown size={18} className="text-white" /> : <ChevronRight size={18} className="text-white" />}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate">{list.name || "Untitled list"}</div>
                          {list.description ? <div className="text-xs text-neutral-500 truncate">{list.description}</div> : null}
                        </div>
                      </button>
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-neutral-400">{listEntries.length} items</div>
                        {isOpen ? (
                          <>
                            <button
                              type="button"
                              onClick={() => onEditList(list)}
                              disabled={!uid}
                              className={cn(
                                "rounded-full border border-white/10 bg-neutral-800/40 px-3 py-1 text-[11px] font-semibold text-neutral-200 transition-colors hover:bg-neutral-800 hover:text-white",
                                !uid ? "cursor-not-allowed opacity-70" : "",
                              )}
                              aria-label="Edit list"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteList(list)}
                              disabled={!uid}
                              className={cn(
                                "rounded-full border border-red-400/20 bg-red-500/10 px-3 py-1 text-[11px] font-semibold text-red-200 transition-colors hover:bg-red-500/20",
                                !uid ? "cursor-not-allowed opacity-70" : "",
                              )}
                              aria-label="Delete list"
                            >
                              Delete
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                    {isOpen ? (
                      listEntries.length === 0 ? (
                        <div className="text-sm text-neutral-400">No items in this list.</div>
                      ) : (
                        <MediaGrid
                          items={listEntries.map((entry) => ({
                            id: entry.id,
                            title: entry.title,
                            image: entry.image,
                            year: entry.releaseYear || undefined,
                            userRating: entry.userRating,
                            imdbRating: entry.imdbRating,
                            type: gridType,
                            onClick: () => onSelectEntry(entry),
                            showActions: true,
                            onView: () => onSelectEntry(entry),
                            onEdit: () => onEditEntry(entry),
                            onDelete: () => onDeleteEntry(entry),
                          }))}
                        />
                      )
                    ) : null}
                  </div>
                );
              });

              const otherEntries = filteredEntries.filter((entry) => !listedIds.has(entry.id));

              return (
                <div className="space-y-10">
                  {listSections.length > 0 ? listSections : null}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-xl border border-white/5 bg-neutral-900/40 px-4 py-3 text-sm font-semibold text-white">
                      <div className="min-w-0">
                        <div className="truncate">Other</div>
                        <div className="text-xs text-neutral-500 truncate">Items not in a list</div>
                      </div>
                      <div className="text-xs text-neutral-400">{otherEntries.length} items</div>
                    </div>
                    {otherEntries.length === 0 ? (
                      <div className="text-sm text-neutral-400">No items found.</div>
                    ) : (
                      <MediaGrid
                        items={otherEntries.map((entry) => ({
                          id: entry.id,
                          title: entry.title,
                          image: entry.image,
                          year: entry.releaseYear || undefined,
                          userRating: entry.userRating,
                          imdbRating: entry.imdbRating,
                          type: gridType,
                          onClick: () => onSelectEntry(entry),
                          showActions: true,
                          onView: () => onSelectEntry(entry),
                          onEdit: () => onEditEntry(entry),
                          onDelete: () => onDeleteEntry(entry),
                        }))}
                      />
                    )}
                  </div>
                </div>
              );
            }}
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
  const { entries, status, error, refresh, selectedEntry, setSelectedEntry } = useData();
  const [libraryFilters, setLibraryFilters] = useState<Record<Exclude<SectionKey, "home">, string>>({
    movies: "",
    series: "",
    anime: "",
    manga: "",
    games: "",
  });
  const [isEditingEntry, setIsEditingEntry] = useState<EntryDoc | null>(null);
  const [isListsModalOpen, setIsListsModalOpen] = useState(false);
  const [listsModalListId, setListsModalListId] = useState<string | null>(null);
  const [listsModalType, setListsModalType] = useState<ListModalType | null>(null);
  const [listsModalMode, setListsModalMode] = useState<"edit" | "delete" | "view">("view");

  const handleEditEntry = (entry: EntryDoc) => {
    setIsEditingEntry(entry);
  };

  const handleEditList = (list: ListRow) => {
    setListsModalListId(list.id);
    setListsModalType(list.type === "anime_movie" ? "anime" : list.type);
    setListsModalMode("edit");
    setIsListsModalOpen(true);
  };

  const handleDeleteList = (list: ListRow) => {
    setListsModalListId(list.id);
    setListsModalType(list.type === "anime_movie" ? "anime" : list.type);
    setListsModalMode("delete");
    setIsListsModalOpen(true);
  };

  const deleteEntry = async (entry: EntryDoc) => {
    if (!uid) return false;
    try {
      await deleteDoc(doc(db, "users", uid, "entries", entry.id));
      return true;
    } catch (error) {
      return false;
    }
  };

  const handleDeleteEntry = async (entry: EntryDoc) => {
    if (!uid) return;
    if (!confirm(`Are you sure you want to delete "${entry.title}"? This action cannot be undone.`)) {
      return;
    }
    const ok = await deleteEntry(entry);
    if (!ok) {
      alert("Failed to delete entry. Please try again.");
    }
  };

  const sectionNode =
    activeSection === "home" ? (
      <DashboardSection
        entries={entries}
        status={status}
        error={error}
        onRetry={refresh}
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
        entries={entries}
        status={status}
        error={error}
        onRetry={refresh}
        onSelectEntry={setSelectedEntry}
        onEditEntry={handleEditEntry}
        onDeleteEntry={handleDeleteEntry}
        onEditList={handleEditList}
        onDeleteList={handleDeleteList}
      />
    ) : activeSection === "series" ? (
      <LibrarySection
        title="Series"
        description="Your logged series."
        mediaTypes={["series"]}
        gridType="series"
        filterRaw={libraryFilters.series}
        onFilterRawChange={(next) => setLibraryFilters((prev) => ({ ...prev, series: next }))}
        entries={entries}
        status={status}
        error={error}
        onRetry={refresh}
        onSelectEntry={setSelectedEntry}
        onEditEntry={handleEditEntry}
        onDeleteEntry={handleDeleteEntry}
        onEditList={handleEditList}
        onDeleteList={handleDeleteList}
      />
    ) : activeSection === "anime" ? (
      <LibrarySection
        title="Anime"
        description="Your logged anime."
        mediaTypes={["anime", "anime_movie"]}
        gridType="anime"
        filterRaw={libraryFilters.anime}
        onFilterRawChange={(next) => setLibraryFilters((prev) => ({ ...prev, anime: next }))}
        entries={entries}
        status={status}
        error={error}
        onRetry={refresh}
        onSelectEntry={setSelectedEntry}
        onEditEntry={handleEditEntry}
        onDeleteEntry={handleDeleteEntry}
        onEditList={handleEditList}
        onDeleteList={handleDeleteList}
      />
    ) : activeSection === "manga" ? (
      <LibrarySection
        title="Manga"
        description="Your logged manga."
        mediaTypes={["manga"]}
        gridType="manga"
        filterRaw={libraryFilters.manga}
        onFilterRawChange={(next) => setLibraryFilters((prev) => ({ ...prev, manga: next }))}
        entries={entries}
        status={status}
        error={error}
        onRetry={refresh}
        onSelectEntry={setSelectedEntry}
        onEditEntry={handleEditEntry}
        onDeleteEntry={handleDeleteEntry}
        onEditList={handleEditList}
        onDeleteList={handleDeleteList}
      />
    ) : (
      <LibrarySection
        title="Games"
        description="Your logged games."
        mediaTypes={["game"]}
        gridType="game"
        filterRaw={libraryFilters.games}
        onFilterRawChange={(next) => setLibraryFilters((prev) => ({ ...prev, games: next }))}
        entries={entries}
        status={status}
        error={error}
        onRetry={refresh}
        onSelectEntry={setSelectedEntry}
        onEditEntry={handleEditEntry}
        onDeleteEntry={handleDeleteEntry}
        onEditList={handleEditList}
        onDeleteList={handleDeleteList}
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
      <EntryDetailModal
        entry={selectedEntry}
        onClose={() => setSelectedEntry(null)}
        onEdit={handleEditEntry}
        onDelete={deleteEntry}
      />
      <LogEntryModal
        isOpen={!!isEditingEntry}
        onClose={() => setIsEditingEntry(null)}
        isEditing={!!isEditingEntry}
        initialMedia={isEditingEntry ? {
          id: isEditingEntry.id,
          title: isEditingEntry.title,
          image: isEditingEntry.image,
          year: isEditingEntry.releaseYear || undefined,
          releaseYear: isEditingEntry.releaseYear || undefined,
          type: isEditingEntry.mediaType,
          description: isEditingEntry.description,
          userRating: isEditingEntry.userRating,
          imdbRating: isEditingEntry.imdbRating,
          lengthMinutes: isEditingEntry.lengthMinutes,
          episodeCount: isEditingEntry.episodeCount,
          chapterCount: isEditingEntry.chapterCount,
          genresThemes: isEditingEntry.genresThemes,
          status: isEditingEntry.status,
          completedAt: isEditingEntry.completedAtMs,
          completionDateUnknown: isEditingEntry.completionDateUnknown,
        } : null}
      />
      <MyListsModal
        isOpen={isListsModalOpen}
        onClose={() => {
          setIsListsModalOpen(false);
          setListsModalListId(null);
          setListsModalType(null);
          setListsModalMode("view");
        }}
        mediaType={listsModalType}
        initialViewListId={listsModalMode === "view" ? listsModalListId : null}
        initialEditListId={listsModalMode === "edit" ? listsModalListId : null}
        initialDeleteListId={listsModalMode === "delete" ? listsModalListId : null}
      />
    </>
  );
}
