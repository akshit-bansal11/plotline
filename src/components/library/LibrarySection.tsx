import { LayoutGrid, List, Pencil, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import { Fragment, useMemo, useState } from "react";
import { MediaGrid } from "@/components/library/MediaGrid";
import { MediaSection } from "@/components/library/MediaSection";
import { RemoveDropTarget } from "@/components/library/RemoveDropTarget";
import { RelationModal, type RelationModalData } from "@/components/relations/RelationModal";
import { LibrarySearchBar } from "@/components/search/LibrarySearchBar";
import { useAuth } from "@/context/AuthContext";
import type { EntryDoc } from "@/context/DataContext";
import { useDragAndDrop } from "@/hooks/useDragAndDrop";
import { useLists } from "@/hooks/useLists";
import type { ListRow } from "@/types/lists";
import { cn, entryMediaTypeLabels, entryStatusLabels } from "@/utils";

export function LibrarySection({
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
  const { lists, listItemsById } = useLists(uid, mediaTypes);

  const [relationModal, setRelationModal] = useState<RelationModalData | null>(null);

  const {
    activeDrag,
    activeDropTarget,
    dragAnnouncement,
    isRemoveTargetActive,
    setActiveDropTarget,
    setReorderIndicator,
    setIsRemoveTargetActive,
    setDragAnnouncement,
    handleItemDragStart,
    handleItemDragEnd,
    handleDropOnList,
    handleRelationDrop,
  } = useDragAndDrop({
    uid,
    entries,
    lists,
    listItemsById,
    onRelationDrop: (sourceId, targetId) => {
      const sourceEntry = entries.find((e) => String(e.id) === sourceId);
      const targetEntry = entries.find((e) => String(e.id) === targetId);
      if (sourceEntry && targetEntry) {
        setRelationModal({
          sourceId,
          targetId,
          type: "Sequel",
          sourceTitle: sourceEntry.title,
          targetTitle: targetEntry.title,
        });
      }
    },
  });

  const [otherStatusFilter, setOtherStatusFilter] = useState<EntryDoc["status"] | "all">("all");

  const sectionEntries = useMemo(() => {
    return entries.filter((entry) => mediaTypes.includes(entry.mediaType));
  }, [entries, mediaTypes]);

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
            <div className="w-full px-4 md:px-8 text-sm text-neutral-400">Loading…</div>
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
                          const previewItems = allListItems
                            .filter((item) => Boolean(item.image))
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
                                    {Array.from(new Set(list.types)).map((type) => (
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
                                      {previewItems.length > 0 ? (
                                        previewItems.map((item) => (
                                          <div
                                            key={`${list.id}-image-${item.id}`}
                                            className="relative h-14 w-14 overflow-hidden rounded-full border-4 border-neutral-950 bg-neutral-800 shadow-2xl ring-1 ring-white/5"
                                          >
                                            <Image
                                              src={item.image!}
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
          <RemoveDropTarget
            isVisible={!!activeDrag && viewMode === "list"}
            isActive={isRemoveTargetActive}
            onDragEnter={(e) => {
              e.preventDefault();
              setIsRemoveTargetActive(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setIsRemoveTargetActive(true);
            }}
            onDragLeave={(e) => {
              const related = e.relatedTarget as HTMLElement | null;
              if (!related || !e.currentTarget.contains(related)) {
                setIsRemoveTargetActive(false);
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsRemoveTargetActive(false);
              void handleDropOnList(null);
            }}
          />
          <div aria-live="polite" className="sr-only">
            {dragAnnouncement}
          </div>
        </>
      )}

      {relationModal && (
        <RelationModal
          uid={uid}
          entries={entries}
          data={relationModal}
          onClose={() => setRelationModal(null)}
          onSuccess={(announcement) => {
            setDragAnnouncement(announcement);
            setRelationModal(null);
          }}
        />
      )}
    </div>
  );
}
