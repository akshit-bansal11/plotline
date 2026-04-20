"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { LayoutGrid, List, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Hero } from "@/components/library/Hero";
import { MediaGrid } from "@/components/library/MediaGrid";
import { MediaSection } from "@/components/library/MediaSection";
import { MyListsModal } from "@/components/lists/MyListsModal";
import { NewListModal } from "@/components/lists/NewListModal";
import { LogEntryModal } from "@/components/log-entry/LogEntryModal";
import { Modal } from "@/components/overlay/Modal";
import { LibrarySearchBar } from "@/components/search/LibrarySearchBar";
import { GlassCard } from "@/components/ui/GlassCard";
import { ImageWithSkeleton } from "@/components/ui/ImageWithSkeleton";
import { useAuth } from "@/context/AuthContext";
import { type EntryDoc, type EntryMediaType, useData } from "@/context/DataContext";
import { type SectionKey, useSection } from "@/context/SectionContext";
import { db } from "@/lib/firebase";
import { deleteLogEntry } from "@/services/log-entry";
import {
  inverseRelationMap,
  RELATION_OPTIONS,
  type RelationType,
  updateBidirectionalRelations,
} from "@/services/relations";
import { cn, entryMediaTypeLabels, entryStatusLabels } from "@/utils";

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
  manga: "Manga",
  game: "Games",
};

type ListRow = {
  id: string;
  name: string;
  description: string;
  type: EntryMediaType;
  types: EntryMediaType[];
};

type ListItemRow = {
  id: string;
  title: string;
  mediaType: EntryMediaType;
  externalId: string;
  image: string | null;
  year: string | null;
  sortOrder: number | null;
  addedAtMs: number | null;
};

type ListModalType = EntryMediaType;

const coerceListType = (value: unknown): EntryMediaType => {
  if (
    value === "movie" ||
    value === "series" ||
    value === "anime" ||
    value === "manga" ||
    value === "game"
  ) {
    return value;
  }
  return "movie";
};

const toMillis = (value: unknown) => {
  if (!value) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (
    typeof value === "object" &&
    value &&
    "toMillis" in value &&
    typeof (value as { toMillis?: unknown }).toMillis === "function"
  ) {
    const millis = (value as { toMillis: () => number }).toMillis();
    return Number.isFinite(millis) ? millis : null;
  }
  return null;
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

  const completedEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (entry.status === "completed") return true;
      // Game specific completion statuses
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
          <div className="mt-3 text-sm text-neutral-500">Syncingâ€¦</div>
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
                            <ImageWithSkeleton
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
                              {entry.releaseYear && entry.completedAtMs ? " â€¢ " : ""}
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

function LibrarySection({
  title,
  mediaTypes,
  gridType,
  viewMode,
  onViewModeChange,
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
  onViewList,
  onOpenNewList,
}: {
  title: string;
  mediaTypes: string[];
  gridType: string;
  viewMode: "list" | "card";
  onViewModeChange: (mode: "list" | "card") => void;
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
  onViewList: (list: ListRow) => void;
  onOpenNewList: () => void;
}) {
  const { user } = useAuth();
  const uid = user?.uid || null;
  const [lists, setLists] = useState<ListRow[]>([]);
  const [listItemsById, setListItemsById] = useState<Record<string, ListItemRow[]>>({});
  const [activeDrag, setActiveDrag] = useState<{
    entryId: string;
    sourceListId: string | null;
    isKeyboard: boolean;
  } | null>(null);
  const [activeDropTarget, setActiveDropTarget] = useState<{
    listId: string | null;
    bucket: "list" | "other" | null;
  } | null>(null);
  const [, setReorderIndicator] = useState<{
    listId: string;
    targetEntryId: string;
    position: "before" | "after";
  } | null>(null);
  const [isRemoveTargetActive, setIsRemoveTargetActive] = useState(false);
  const [dragAnnouncement, setDragAnnouncement] = useState("");
  const [otherStatusFilter, setOtherStatusFilter] = useState<EntryDoc["status"] | "all">("all");

  const [relationModal, setRelationModal] = useState<{
    sourceId: string;
    targetId: string;
    type: RelationType;
    targetTitle: string;
    sourceTitle: string;
  } | null>(null);
  const [relationModalError, setRelationModalError] = useState<string | null>(null);
  const [isRelationSaving, setIsRelationSaving] = useState(false);

  const handleRelationDrop = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) {
      handleItemDragEnd({ preserveAnnouncement: true });
      setDragAnnouncement("Cannot relate an entry to itself.");
      return;
    }
    const sourceEntry = entries.find((e) => String(e.id) === sourceId);
    const targetEntry = entries.find((e) => String(e.id) === targetId);
    if (!sourceEntry || !targetEntry) {
      handleItemDragEnd({ preserveAnnouncement: true });
      setDragAnnouncement("Could not create the relationship from this drop.");
      return;
    }

    setRelationModalError(null);
    setRelationModal({
      sourceId,
      targetId,
      type: "Sequel",
      sourceTitle: sourceEntry.title,
      targetTitle: targetEntry.title,
    });
    handleItemDragEnd({ preserveAnnouncement: true });
    setDragAnnouncement(
      `Dropped ${sourceEntry.title} onto ${targetEntry.title}. Choose a relationship type.`,
    );
  };

  const sectionEntries = useMemo(() => {
    return entries.filter((entry) => mediaTypes.includes(entry.mediaType));
  }, [entries, mediaTypes]);

  useEffect(() => {
    if (!uid) return;

    const listsQuery = query(
      collection(db, "users", uid, "lists"),
      orderBy("createdAt", "desc"),
      limit(50),
    );
    const unsubscribe = onSnapshot(listsQuery, (snapshot) => {
      const nextLists = snapshot.docs.map((snap) => {
        const data = snap.data() as {
          name?: unknown;
          description?: unknown;
          type?: unknown;
          types?: unknown;
        };
        const singleType = coerceListType(data.type);
        const types = Array.isArray(data.types) ? (data.types as EntryMediaType[]) : [singleType];

        // Normalize types for filtering: if it has anime or anime_movie, it counts for both
        const normalizedTypes = types.map((t) => ((t as string) === "anime_movie" ? "anime" : t));

        return {
          id: snap.id,
          name: typeof data.name === "string" ? data.name : "",
          description: typeof data.description === "string" ? data.description : "",
          type: singleType,
          types,
          normalizedTypes,
        };
      });

      const filteredLists = nextLists.filter((list) =>
        list.normalizedTypes.some((t) => {
          const normalizedMediaTypes = mediaTypes.map((m) =>
            (m as string) === "anime_movie" ? "anime" : m,
          );
          return normalizedMediaTypes.includes(t);
        }),
      );

      setLists(filteredLists);
    });

    return () => unsubscribe();
  }, [mediaTypes, uid]);

  // Use a ref to track active unsubscribers to avoid churn
  const unsubscribersRef = useRef<Map<string, () => void>>(new Map());

  useEffect(() => {
    if (!uid) return;

    // Remove unsubscribers for lists that are no longer present
    const activeListIdSet = new Set(lists.map((l) => l.id));
    unsubscribersRef.current.forEach((unsub, id) => {
      if (!activeListIdSet.has(id)) {
        unsub();
        unsubscribersRef.current.delete(id);
        // Also clean up the items state
        setListItemsById((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    });

    // Create unsubscribers for new lists
    lists.forEach((list) => {
      if (!unsubscribersRef.current.has(list.id)) {
        const itemsQuery = query(
          collection(db, "users", uid, "lists", list.id, "items"),
          orderBy("addedAt", "desc"),
          limit(500),
        );
        const unsub = onSnapshot(itemsQuery, (snapshot) => {
          const nextItems = snapshot.docs.map((snap) => {
            const data = snap.data() as Partial<ListItemRow> & {
              mediaType?: unknown;
              externalId?: unknown;
              image?: unknown;
              year?: unknown;
              title?: unknown;
            };
            return {
              id: snap.id,
              title: typeof data.title === "string" ? data.title : "",
              mediaType: coerceListType(data.mediaType),
              externalId: typeof data.externalId === "string" ? data.externalId : "",
              image: data.image ? String(data.image) : null,
              year: data.year ? String(data.year) : null,
              sortOrder: typeof data.sortOrder === "number" ? data.sortOrder : null,
              addedAtMs: toMillis((data as Record<string, unknown>).addedAt),
            };
          });
          const sortedItems = [...nextItems].sort((a, b) => {
            const aSort = a.sortOrder;
            const bSort = b.sortOrder;
            if (typeof aSort === "number" && typeof bSort === "number") return aSort - bSort;
            if (typeof aSort === "number") return -1;
            if (typeof bSort === "number") return 1;
            return (b.addedAtMs ?? 0) - (a.addedAtMs ?? 0);
          });
          setListItemsById((prev) => ({ ...prev, [list.id]: sortedItems }));
        });
        unsubscribersRef.current.set(list.id, unsub);
      }
    });

    // Cleanup all on unmount
    return () => {
      // We don't want to cleanup on every list change, only on unmount or uid change
    };
  }, [lists, uid]);

  useEffect(() => {
    const currentUnsubs = unsubscribersRef.current;
    return () => {
      for (const unsub of currentUnsubs.values()) {
        unsub();
      }
      currentUnsubs.clear();
    };
  }, []);

  // Handle auto-scroll during drag
  useEffect(() => {
    if (!activeDrag) return;

    const threshold = 120;
    const speed = 15;
    let scrollInterval: ReturnType<typeof setInterval> | null = null;

    const handleDragOver = (e: DragEvent) => {
      const { clientY } = e;
      const innerHeight = window.innerHeight;

      if (clientY < threshold) {
        // Scroll up
        if (!scrollInterval) {
          scrollInterval = setInterval(() => {
            window.scrollBy(0, -speed);
          }, 16);
        }
      } else if (clientY > innerHeight - threshold) {
        // Scroll down
        if (!scrollInterval) {
          scrollInterval = setInterval(() => {
            window.scrollBy(0, speed);
          }, 16);
        }
      } else if (scrollInterval) {
        clearInterval(scrollInterval);
        scrollInterval = null;
      }
    };

    const stopScroll = () => {
      if (scrollInterval) {
        clearInterval(scrollInterval);
        scrollInterval = null;
      }
    };

    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragend", stopScroll);
    window.addEventListener("drop", stopScroll);

    return () => {
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragend", stopScroll);
      window.removeEventListener("drop", stopScroll);
      if (scrollInterval) clearInterval(scrollInterval);
    };
  }, [activeDrag]);

  const clearExpandTimeout = () => {};

  const handleItemDragStart = (details: {
    entryId: string | number;
    sourceListId: string | null;
    title: string;
    mode: "mouse" | "keyboard" | "touch";
  }) => {
    if (!uid) return;
    const entryId = String(details.entryId);
    setActiveDrag({
      entryId,
      sourceListId: details.sourceListId,
      isKeyboard: details.mode === "keyboard",
    });
    setDragAnnouncement(`Picked up ${details.title}. Navigate to a list and drop to move it.`);
    setReorderIndicator(null);
    setIsRemoveTargetActive(false);
  };

  const handleItemDragEnd = (options?: { preserveAnnouncement?: boolean }) => {
    clearExpandTimeout();
    if (activeDrag && !options?.preserveAnnouncement) {
      setDragAnnouncement("Drag cancelled.");
    }
    setActiveDrag(null);
    setActiveDropTarget(null);
    setReorderIndicator(null);
    setIsRemoveTargetActive(false);
  };

  const handleDropOnList = async (targetListId: string | null) => {
    if (!uid || !activeDrag) return;
    const entry = sectionEntries.find((candidate) => candidate.id === activeDrag.entryId);
    if (!entry) {
      setDragAnnouncement("Could not find this item in the current view.");
      setActiveDrag(null);
      setActiveDropTarget(null);
      setReorderIndicator(null);
      setIsRemoveTargetActive(false);
      clearExpandTimeout();
      return;
    }

    const sourceListId = activeDrag.sourceListId;
    const targetList = targetListId ? lists.find((list) => list.id === targetListId) || null : null;
    const targetItems = targetList ? listItemsById[targetList.id] || [] : [];

    if (targetListId && !targetList) {
      setDragAnnouncement("Target list is not available.");
      setActiveDrag(null);
      setActiveDropTarget(null);
      setReorderIndicator(null);
      setIsRemoveTargetActive(false);
      clearExpandTimeout();
      return;
    }

    if (targetListId && sourceListId === targetListId) {
      setDragAnnouncement("This item is already in the selected list.");
      setActiveDrag(null);
      setActiveDropTarget(null);
      setReorderIndicator(null);
      setIsRemoveTargetActive(false);
      clearExpandTimeout();
      return;
    }

    if (targetList) {
      const normalizedEntryType: EntryMediaType =
        (entry.mediaType as string) === "anime_movie" ? "anime" : entry.mediaType;
      if (!targetList.types.includes(normalizedEntryType)) {
        setDragAnnouncement(
          `This list only accepts ${targetList.types.map((t) => entryMediaTypeLabels[t]).join(", ")} items.`,
        );
        setActiveDrag(null);
        setActiveDropTarget(null);
        setReorderIndicator(null);
        setIsRemoveTargetActive(false);
        clearExpandTimeout();
        return;
      }
      const alreadyInTarget = targetItems.some((item) => item.externalId === entry.id);
      if (alreadyInTarget) {
        setDragAnnouncement("This item is already in the target list.");
        setActiveDrag(null);
        setActiveDropTarget(null);
        setReorderIndicator(null);
        setIsRemoveTargetActive(false);
        clearExpandTimeout();
        return;
      }
    }

    try {
      if (targetList) {
        const manualOrderValues = targetItems
          .map((item) => item.sortOrder)
          .filter((value): value is number => typeof value === "number");
        const nextSortOrder =
          manualOrderValues.length > 0 ? Math.max(...manualOrderValues) + 1 : null;
        await addDoc(collection(db, "users", uid, "lists", targetList.id, "items"), {
          title: entry.title,
          mediaType: entry.mediaType,
          externalId: entry.id,
          image: entry.image || null,
          year: entry.releaseYear || null,
          sortOrder: nextSortOrder,
          addedAt: serverTimestamp(),
        });
        await updateDoc(doc(db, "users", uid, "lists", targetList.id), {
          updatedAt: serverTimestamp(),
        });
      }

      if (sourceListId) {
        const sourceItems = listItemsById[sourceListId] || [];
        const sourceItem = sourceItems.find((item) => item.externalId === entry.id);
        if (sourceItem) {
          await deleteDoc(doc(db, "users", uid, "lists", sourceListId, "items", sourceItem.id));
          await updateDoc(doc(db, "users", uid, "lists", sourceListId), {
            updatedAt: serverTimestamp(),
          });
        }
      }

      if (!targetList && sourceListId) {
        setDragAnnouncement(`Removed ${entry.title} from the list. It remains in Unspecified.`);
      } else {
        const targetName = targetList ? targetList.name || "List" : "Other";
        setDragAnnouncement(`Moved ${entry.title} to ${targetName}.`);
      }
    } catch {
      setDragAnnouncement("Failed to move item. Please try again.");
    } finally {
      setActiveDrag(null);
      setActiveDropTarget(null);
      setReorderIndicator(null);
      setIsRemoveTargetActive(false);
      clearExpandTimeout();
    }
  };

  const visibleEntriesError = uid ? error : null;

  return (
    <div className="pt-12">
      <div className="w-full px-4 md:px-8 mb-4">
        <h1 className="text-3xl font-bold tracking-tight text-white">{title}</h1>
      </div>

      {!uid ? (
        <div className="w-full px-4 md:px-8 text-sm text-neutral-500">
          Sign in to see your library.
        </div>
      ) : (
        <>
          {uid && status === "loading" && entries.length === 0 ? (
            <div className="w-full px-4 md:px-8 text-sm text-neutral-400">Loadingâ€¦</div>
          ) : null}
          {visibleEntriesError ? (
            <div className="w-full px-4 md:px-8 flex flex-wrap items-center gap-3 text-sm text-red-400">
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
          <div className="w-full px-4 md:px-8">
            <div className="mb-3 flex items-center gap-2">
              <div className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-neutral-900/50 p-1">
                <button
                  type="button"
                  onClick={() => onViewModeChange("list")}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                    viewMode === "list"
                      ? "bg-white/10 text-white"
                      : "text-neutral-400 hover:text-neutral-200",
                  )}
                  aria-pressed={viewMode === "list"}
                  aria-label="List view"
                  title="List view"
                >
                  <List size={14} />
                  List
                </button>
                <button
                  type="button"
                  onClick={() => onViewModeChange("card")}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                    viewMode === "card"
                      ? "bg-white/10 text-white"
                      : "text-neutral-400 hover:text-neutral-200",
                  )}
                  aria-pressed={viewMode === "card"}
                  aria-label="Card view"
                  title="Card view"
                >
                  <LayoutGrid size={14} />
                  Card
                </button>
              </div>
              <LibrarySearchBar className="w-65 sm:w-[320px] md:w-90" />
              {viewMode === "list" && (
                <button
                  type="button"
                  onClick={onOpenNewList}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-neutral-900/50 px-3 py-2 text-xs font-medium text-neutral-200 transition-colors hover:bg-neutral-900/70 hover:text-white"
                  aria-label="New list"
                  title="New list"
                >
                  <Plus size={14} />
                  New List
                </button>
              )}
            </div>
          </div>
          <MediaSection
            items={sectionEntries}
            getGenresThemes={(entry) => entry.genresThemes}
            getFilterValues={(entry) => [entry.releaseYear, entry.userRating, entry.imdbRating]}
            title="Results"
            filterRaw={filterRaw}
            onFilterRawChange={onFilterRawChange}
            showFilterInput={false}
          >
            {(filteredEntries) => {
              const filteredById = new Map(filteredEntries.map((entry) => [entry.id, entry]));
              const listedIds = new Set<string>();

              const listSectionsData = lists.map((list) => {
                const allListItems = listItemsById[list.id] || [];
                const listEntries = allListItems
                  .map((item) => filteredById.get(item.externalId))
                  .filter((entry): entry is EntryDoc => Boolean(entry));
                listEntries.forEach((entry) => {
                  listedIds.add(entry.id);
                });
                return { list, listEntries, allListItems };
              });

              const otherEntries = filteredEntries.filter((entry) => !listedIds.has(entry.id));
              const otherStatusOptions = Array.from(
                new Set(otherEntries.map((entry) => entry.status)),
              ) as EntryDoc["status"][];
              const filteredOtherEntries =
                otherStatusFilter === "all"
                  ? otherEntries
                  : otherEntries.filter((entry) => entry.status === otherStatusFilter);
              const listSections = listSectionsData.sort((a, b) => {
                const aEmpty = a.listEntries.length === 0;
                const bEmpty = b.listEntries.length === 0;
                if (aEmpty && !bEmpty) return 1;
                if (!aEmpty && bEmpty) return -1;
                return 0;
              });
              const isListView = viewMode === "list";

              return (
                <div
                  className={cn(
                    "flex flex-col gap-10",
                    isListView && listSections.length > 0 ? "lg:flex-row lg:items-start" : "",
                  )}
                >
                  {isListView && listSections.length > 0 && (
                    <div className="lg:w-135 xl:w-180 2xl:w-225 shrink-0 space-y-8">
                      <div className="flex items-center justify-between px-2">
                        <h2 className="text-[11px] font-extrabold uppercase tracking-[0.4em] text-neutral-500">
                          Collections
                        </h2>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
                        {listSections.map(({ list, allListItems }) => {
                          const isEmpty = allListItems.length === 0;
                          const previewImages = allListItems
                            .map((item) => item.image)
                            .filter((image): image is string => Boolean(image))
                            .slice(0, 5);
                          return (
                            <Fragment key={list.id}>
                              <div className="group/list-card relative min-w-0 w-full h-full">
                                {/* List header card */}
                                <button
                                  type="button"
                                  onDragEnter={(event) => {
                                    if (!activeDrag) return;
                                    event.preventDefault();
                                    setActiveDropTarget({
                                      listId: list.id,
                                      bucket: "list",
                                    });
                                    setReorderIndicator(null);
                                    clearExpandTimeout();
                                  }}
                                  onDragOver={(event) => {
                                    if (!activeDrag) return;
                                    event.preventDefault();
                                  }}
                                  onDragLeave={(event) => {
                                    if (!activeDrag) return;
                                    const related = event.relatedTarget as HTMLElement | null;
                                    if (!related || !event.currentTarget.contains(related)) {
                                      if (
                                        activeDropTarget?.listId === list.id &&
                                        activeDropTarget.bucket === "list"
                                      ) {
                                        setActiveDropTarget(null);
                                      }
                                    }
                                  }}
                                  onDrop={(event) => {
                                    if (!activeDrag) return;
                                    event.preventDefault();
                                    handleDropOnList(list.id);
                                  }}
                                  onClick={() => {
                                    if (activeDrag) {
                                      handleDropOnList(list.id);
                                      return;
                                    }
                                    onViewList(list);
                                  }}
                                  className={cn(
                                    "group flex h-full w-full flex-col gap-6 rounded-4xl border p-6 pr-24 text-left transition-all select-none",
                                    isEmpty
                                      ? "border-white/5 bg-neutral-900/20 text-neutral-600"
                                      : "border-white/10 bg-neutral-900/40 text-neutral-300 hover:bg-neutral-900/60 hover:text-white hover:border-white/20",
                                    activeDropTarget?.listId === list.id &&
                                      activeDropTarget.bucket === "list"
                                      ? "media-card-drop-target scale-[1.03] rotate-1"
                                      : "",
                                  )}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <div className="truncate text-2xl font-bold text-white tracking-tight">
                                          {list.name || "Untitled list"}
                                        </div>
                                        <div className="mt-1 text-xs text-neutral-500 shrink-0 font-medium">
                                          {allListItems.length} item
                                          {allListItems.length === 1 ? "" : "s"}
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap gap-2">
                                    {list.types.map((type) => (
                                      <span
                                        key={`${list.id}-${type}`}
                                        className="rounded-full border border-white/5 bg-white/3 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-neutral-400 group-hover:text-neutral-200 transition-colors"
                                      >
                                        {entryMediaTypeLabels[type]}
                                      </span>
                                    ))}
                                  </div>

                                  <div
                                    className={`line-clamp-2 min-h-10 text-sm text-neutral-500 group-hover:text-neutral-300 transition-colors leading-relaxed font-medium ${
                                      list.description ? "" : "hidden"
                                    }`}
                                  >
                                    {list.description}
                                  </div>

                                  <div className="mt-auto flex items-center justify-between gap-3">
                                    <div className="flex -space-x-3">
                                      {previewImages.length > 0 ? (
                                        previewImages.map((image) => (
                                          <div
                                            key={`${list.id}-image-${image}`}
                                            className="relative h-14 w-14 overflow-hidden rounded-full border-4 border-neutral-950 bg-neutral-800 shadow-2xl ring-1 ring-white/5"
                                          >
                                            <ImageWithSkeleton
                                              src={image}
                                              alt=""
                                              fill
                                              className="object-cover"
                                            />
                                          </div>
                                        ))
                                      ) : (
                                        <div className="h-14 w-14 rounded-full border-2 border-dashed border-white/5 bg-neutral-900/20" />
                                      )}
                                    </div>
                                  </div>
                                </button>

                                <div className="pointer-events-none absolute right-4 top-4 z-20 flex items-center gap-1 opacity-0 transition-opacity group-hover/list-card:opacity-100 group-focus-within/list-card:opacity-100">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onEditList(list);
                                    }}
                                    disabled={!uid}
                                    className="pointer-events-auto rounded-lg p-2 text-neutral-500 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                                    aria-label="Edit list"
                                  >
                                    <Pencil size={14} />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      onDeleteList(list);
                                    }}
                                    disabled={!uid}
                                    className="pointer-events-auto rounded-lg p-2 text-neutral-500 transition-colors hover:bg-red-500/10 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                                    aria-label="Delete list"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                            </Fragment>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex-1 min-w-0 space-y-6">
                    {/* Unlisted entries */}
                    {isListView && (
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-4">
                          <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-500">
                            {otherEntries.length > 0 ? "Library" : "No Unlisted Items"}
                          </h2>
                          {otherStatusOptions.length > 1 && (
                            <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-neutral-900/30 border border-white/5">
                              <button
                                type="button"
                                onClick={() => setOtherStatusFilter("all")}
                                className={cn(
                                  "rounded-lg px-3 py-1 text-[9px] font-bold uppercase tracking-wider transition-all",
                                  otherStatusFilter === "all"
                                    ? "bg-white text-black shadow-lg"
                                    : "text-neutral-500 hover:text-neutral-300",
                                )}
                              >
                                All
                              </button>
                              {otherStatusOptions.map((statusOption) => (
                                <button
                                  key={statusOption}
                                  type="button"
                                  onClick={() =>
                                    setOtherStatusFilter(
                                      otherStatusFilter === statusOption ? "all" : statusOption,
                                    )
                                  }
                                  className={cn(
                                    "rounded-lg px-3 py-1 text-[9px] font-bold uppercase tracking-wider transition-all",
                                    otherStatusFilter === statusOption
                                      ? "bg-white text-black shadow-lg"
                                      : "text-neutral-500 hover:text-neutral-300",
                                  )}
                                >
                                  {entryStatusLabels[statusOption]}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {otherEntries.length > 0 && (
                          <MediaGrid
                            className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2"
                            items={filteredOtherEntries.map((entry) => ({
                              id: entry.id,
                              title: entry.title,
                              description: entry.description,
                              image: entry.image,
                              year: entry.releaseYear || undefined,
                              userRating: entry.userRating,
                              imdbRating: entry.imdbRating,
                              status: entry.status,
                              type: gridType,
                              relations: entry.relations,
                              onClick: () => onSelectEntry(entry),
                              showActions: true,
                              onEdit: () => onEditEntry(entry),
                              onDelete: () => onDeleteEntry(entry),
                            }))}
                            sourceListId={null}
                            activeDragEntryId={activeDrag?.entryId ?? null}
                            onItemDragStart={handleItemDragStart}
                            onItemDragEnd={handleItemDragEnd}
                            onItemDropOnItem={({ targetEntryId }) => {
                              if (activeDrag) {
                                handleRelationDrop(String(activeDrag.entryId), targetEntryId);
                              }
                            }}
                          />
                        )}
                      </div>
                    )}

                    {!isListView && filteredEntries.length > 0 && (
                      <MediaGrid
                        className="grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
                        items={filteredEntries.map((entry) => ({
                          id: entry.id,
                          title: entry.title,
                          description: entry.description,
                          image: entry.image,
                          year: entry.releaseYear || undefined,
                          userRating: entry.userRating,
                          imdbRating: entry.imdbRating,
                          status: entry.status,
                          type: gridType,
                          relations: entry.relations,
                          onClick: () => onSelectEntry(entry),
                          showActions: true,
                          onEdit: () => onEditEntry(entry),
                          onDelete: () => onDeleteEntry(entry),
                        }))}
                        sourceListId={null}
                        activeDragEntryId={activeDrag?.entryId ?? null}
                        onItemDragStart={handleItemDragStart}
                        onItemDragEnd={handleItemDragEnd}
                        onItemDropOnItem={({ targetEntryId }) => {
                          if (activeDrag) {
                            handleRelationDrop(String(activeDrag.entryId), targetEntryId);
                          }
                        }}
                      />
                    )}
                  </div>
                </div>
              );
            }}
          </MediaSection>
          <AnimatePresence>
            {activeDrag && viewMode === "list" ? (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
              >
                <button
                  type="button"
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setIsRemoveTargetActive(true);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsRemoveTargetActive(true);
                  }}
                  onDragLeave={(event) => {
                    const related = event.relatedTarget as HTMLElement | null;
                    if (!related || !event.currentTarget.contains(related)) {
                      setIsRemoveTargetActive(false);
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setIsRemoveTargetActive(false);
                    void handleDropOnList(null);
                  }}
                  className={cn(
                    "flex h-16 w-16 items-center justify-center rounded-full border text-white shadow-2xl backdrop-blur-xl transition-colors",
                    isRemoveTargetActive
                      ? "border-red-300/80 bg-red-500/30"
                      : "border-white/20 bg-neutral-900/70",
                  )}
                  title="Drop here to remove from list"
                >
                  <X size={24} />
                </button>
              </motion.div>
            ) : null}
          </AnimatePresence>
          <div aria-live="polite" className="sr-only">
            {dragAnnouncement}
          </div>
        </>
      )}

      {relationModal && (
        <Modal
          isOpen={!!relationModal}
          onClose={() => {
            if (isRelationSaving) return;
            setRelationModal(null);
            setRelationModalError(null);
          }}
          title="Create Relationship"
          className="bg-neutral-900/80 max-w-md"
        >
          <div className="space-y-4">
            <p className="text-sm text-neutral-300">
              You dropped <strong>{relationModal.sourceTitle}</strong> onto{" "}
              <strong>{relationModal.targetTitle}</strong>.
            </p>
            <div className="space-y-2">
              <label className="text-xs font-medium text-neutral-400" htmlFor="relationship-type">
                Relationship Type
              </label>
              <select
                id="relationship-type"
                value={relationModal.type}
                onChange={(e) => {
                  setRelationModalError(null);
                  setRelationModal((prev) =>
                    prev ? { ...prev, type: e.target.value as RelationType } : null,
                  );
                }}
                className="w-full bg-neutral-950 border border-white/10 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-white/20"
              >
                {RELATION_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-neutral-500 mt-1">
                This will set <span className="text-white">{relationModal.sourceTitle}</span> as a{" "}
                <span className="text-white font-medium">{relationModal.type}</span> of{" "}
                <span className="text-white">{relationModal.targetTitle}</span>.
              </p>
            </div>
            {relationModalError ? (
              <div className="text-xs text-red-400">{relationModalError}</div>
            ) : null}
            <div className="flex gap-3 justify-end pt-4 border-t border-white/5 mt-2">
              <button
                type="button"
                onClick={() => {
                  if (isRelationSaving) return;
                  setRelationModal(null);
                  setRelationModalError(null);
                }}
                className="px-4 py-2 text-sm text-neutral-400 hover:text-white transition-colors"
                disabled={isRelationSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!uid || !relationModal || isRelationSaving) return;
                  const sourceDoc = entries.find((e) => String(e.id) === relationModal.sourceId);
                  if (!sourceDoc) return;

                  const oldRelations = Array.isArray(sourceDoc.relations)
                    ? sourceDoc.relations.filter(
                        (r) => Boolean(r.targetId) && Boolean(r.type) && !r.inferred,
                      )
                    : [];
                  const sourceRelationType =
                    inverseRelationMap[relationModal.type] || relationModal.type;

                  const relationsForTarget = oldRelations.filter(
                    (r) => r.targetId === relationModal.targetId,
                  );
                  const existingRelation = relationsForTarget[0] || null;
                  if (
                    relationsForTarget.length === 1 &&
                    existingRelation?.type === sourceRelationType
                  ) {
                    setRelationModalError("This relationship already exists.");
                    return;
                  }

                  const updatedRelation = {
                    targetId: relationModal.targetId,
                    type: sourceRelationType,
                    createdAtMs: Date.now(),
                  };

                  const newRelations = [
                    ...oldRelations.filter((r) => r.targetId !== relationModal.targetId),
                    updatedRelation,
                  ];

                  setRelationModalError(null);
                  setIsRelationSaving(true);
                  try {
                    await updateDoc(doc(db, "users", uid, "entries", relationModal.sourceId), {
                      relations: newRelations,
                      updatedAt: serverTimestamp(),
                    });

                    await updateBidirectionalRelations(
                      uid,
                      relationModal.sourceId,
                      oldRelations,
                      newRelations,
                    );
                    setDragAnnouncement(
                      existingRelation
                        ? `Updated: ${relationModal.targetTitle} is now ${relationModal.type} of ${relationModal.sourceTitle}.`
                        : `Linked: ${relationModal.targetTitle} is ${relationModal.type} of ${relationModal.sourceTitle}.`,
                    );
                    setRelationModal(null);
                  } catch {
                    setRelationModalError("Failed to save relationship. Please try again.");
                  } finally {
                    setIsRelationSaving(false);
                  }
                }}
                className="px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-semibold"
                disabled={isRelationSaving}
              >
                {isRelationSaving ? "Saving..." : "Create Link"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const uid = user?.uid || null;
  const { activeSection } = useSection();
  const { entries, status, error, refresh } = useData();
  const [libraryFilters, setLibraryFilters] = useState<Record<Exclude<SectionKey, "home">, string>>(
    {
      movies: "",
      series: "",
      anime: "",
      manga: "",
      games: "",
    },
  );
  const [libraryViewModes, setLibraryViewModes] = useState<
    Record<Exclude<SectionKey, "home">, "list" | "card">
  >({
    movies: "list",
    series: "list",
    anime: "list",
    manga: "list",
    games: "list",
  });
  const [isEditingEntry, setIsEditingEntry] = useState<EntryDoc | null>(null);
  const [viewingEntry, setViewingEntry] = useState<EntryDoc | null>(null);
  const [isListsModalOpen, setIsListsModalOpen] = useState(false);
  const [isNewListOpen, setIsNewListOpen] = useState(false);
  const [newListDefaultType, setNewListDefaultType] = useState<ListModalType>("movie");
  const [listsModalListId, setListsModalListId] = useState<string | null>(null);
  const [listsModalType, setListsModalType] = useState<ListModalType | null>(null);
  const [listsModalMode, setListsModalMode] = useState<"edit" | "delete" | "view">("view");
  const setFilterFor = useCallback(
    (key: Exclude<SectionKey, "home">) => (next: string) =>
      setLibraryFilters((prev) => ({ ...prev, [key]: next })),
    [],
  );
  const setViewModeFor = useCallback(
    (key: Exclude<SectionKey, "home">) => (next: "list" | "card") =>
      setLibraryViewModes((prev) => ({ ...prev, [key]: next })),
    [],
  );

  const handleEditEntry = useCallback(
    (entry: EntryDoc) => {
      const latestEntry = entries.find((candidate) => candidate.id === entry.id) || entry;
      setIsEditingEntry(latestEntry);
    },
    [entries],
  );

  const handleViewEntry = useCallback(
    (entry: EntryDoc) => {
      const latestEntry = entries.find((candidate) => candidate.id === entry.id) || entry;
      setViewingEntry(latestEntry);
    },
    [entries],
  );

  const handleEditList = useCallback((list: ListRow) => {
    setListsModalListId(list.id);
    setListsModalType((list.type as string) === "anime_movie" ? "anime" : list.type);
    setListsModalMode("edit");
    setIsListsModalOpen(true);
  }, []);

  const handleDeleteList = useCallback((list: ListRow) => {
    setListsModalListId(list.id);
    setListsModalType((list.type as string) === "anime_movie" ? "anime" : list.type);
    setListsModalMode("delete");
    setIsListsModalOpen(true);
  }, []);

  const handleViewList = useCallback((list: ListRow) => {
    setListsModalListId(list.id);
    setListsModalType((list.type as string) === "anime_movie" ? "anime" : list.type);
    setListsModalMode("view");
    setIsListsModalOpen(true);
  }, []);

  const handleOpenNewList = useCallback((type: ListModalType) => {
    setNewListDefaultType(type);
    setIsNewListOpen(true);
  }, []);

  const deleteEntry = useCallback(
    async (entry: EntryDoc) => {
      try {
        if (!uid) return false;
        await deleteLogEntry(uid, entry.id, entries);
        return true;
      } catch (err) {
        console.error("Failed to delete entry:", err);
        return false;
      }
    },
    [uid, entries],
  );

  const handleDeleteEntry = useCallback(
    async (entry: EntryDoc) => {
      const confirmed = confirm(`Are you sure you want to delete "${entry.title}"?`);
      if (!confirmed) {
        return;
      }
      const ok = await deleteEntry(entry);
      if (!ok) {
        alert("Failed to delete entry. Please try again.");
      }
    },
    [deleteEntry],
  );

  const sectionConfigs = useMemo(() => {
    const configs: Record<
      Exclude<SectionKey, "home">,
      { title: string; mediaTypes: string[]; gridType: string }
    > = {
      movies: { title: "Movies", mediaTypes: ["movie"], gridType: "movie" },
      series: { title: "Series", mediaTypes: ["series"], gridType: "series" },
      anime: {
        title: "Anime",
        mediaTypes: ["anime", "anime_movie"],
        gridType: "anime",
      },
      manga: { title: "Manga", mediaTypes: ["manga"], gridType: "manga" },
      games: { title: "Games", mediaTypes: ["game"], gridType: "game" },
    };
    return configs;
  }, []);

  const sectionNode = useMemo(() => {
    if (activeSection === "home") {
      return (
        <DashboardSection
          entries={entries}
          status={status}
          error={error}
          onRetry={refresh}
          onSelectEntry={handleViewEntry}
        />
      );
    }

    const config = sectionConfigs[activeSection as Exclude<SectionKey, "home">];
    return (
      <LibrarySection
        key={activeSection}
        title={config.title}
        mediaTypes={config.mediaTypes}
        gridType={config.gridType}
        viewMode={libraryViewModes[activeSection as Exclude<SectionKey, "home">]}
        onViewModeChange={setViewModeFor(activeSection as Exclude<SectionKey, "home">)}
        filterRaw={libraryFilters[activeSection as Exclude<SectionKey, "home">]}
        onFilterRawChange={setFilterFor(activeSection as Exclude<SectionKey, "home">)}
        entries={entries}
        status={status}
        error={error}
        onRetry={refresh}
        onSelectEntry={handleViewEntry}
        onEditEntry={handleEditEntry}
        onDeleteEntry={handleDeleteEntry}
        onEditList={handleEditList}
        onDeleteList={handleDeleteList}
        onViewList={handleViewList}
        onOpenNewList={() => handleOpenNewList(config.gridType as ListModalType)}
      />
    );
  }, [
    activeSection,
    entries,
    status,
    error,
    refresh,
    sectionConfigs,
    libraryFilters,
    libraryViewModes,
    handleEditEntry,
    handleViewEntry,
    handleDeleteEntry,
    handleEditList,
    handleDeleteList,
    handleViewList,
    handleOpenNewList,
    setFilterFor,
    setViewModeFor,
  ]);

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
      <LogEntryModal
        isOpen={!!isEditingEntry || !!viewingEntry}
        onClose={() => {
          setIsEditingEntry(null);
          setViewingEntry(null);
        }}
        mode={isEditingEntry ? "edit" : "view"}
        initialMedia={(() => {
          const entry = isEditingEntry || viewingEntry;
          if (!entry) return null;
          return {
            id: entry.id,
            title: entry.title,
            image: entry.image,
            year: entry.releaseYear || undefined,
            releaseYear: entry.releaseYear || undefined,
            type: entry.mediaType,
            description: entry.description,
            userRating: entry.userRating,
            imdbRating: entry.imdbRating,
            lengthMinutes: entry.lengthMinutes,
            episodeCount: entry.episodeCount,
            chapterCount: entry.chapterCount,
            playTime: entry.playTime,
            achievements: entry.achievements,
            totalAchievements: entry.totalAchievements,
            platform: entry.platform,
            isMovie: entry.isMovie,
            listIds: entry.listIds,
            genresThemes: entry.genresThemes,
            relations: entry.relations,
            status: entry.status,
            completedAt: entry.completedAtMs,
            completionDateUnknown: entry.completionDateUnknown,
          };
        })()}
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
      <NewListModal
        isOpen={isNewListOpen}
        onClose={() => setIsNewListOpen(false)}
        defaultType={newListDefaultType}
      />
    </>
  );
}
