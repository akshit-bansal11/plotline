// File: src/components/library/LibrarySection.tsx
// Purpose: Core library view with filtering, list management, and drag-and-drop orchestration

"use client";

// ─── Icons
import { LayoutGrid, Library, List, Pencil, Plus, Trash2 } from "lucide-react";
// ─── React
import { useMemo } from "react";
// ─── Internal — components
import { MediaGrid } from "@/components/library/MediaGrid";
import { MediaSection } from "@/components/library/MediaSection";
import { RemoveDropTarget } from "@/components/library/RemoveDropTarget";
import { RelationModal } from "@/components/relations/RelationModal";
import { LibrarySearchBar } from "@/components/search/LibrarySearchBar";
// ─── Internal — hooks
import { useAuth } from "@/context/AuthContext";
// ─── Internal — types
import type { EntryDoc } from "@/context/DataContext";
import { useDragAndDrop } from "@/hooks/useDragAndDrop";
import { useLibraryHandlers } from "@/hooks/useLibraryHandlers";
import { useLists } from "@/hooks/useLists";
import type { ListItemRow, ListRow } from "@/types/lists";

// ─── Internal — utils
import { cn } from "@/utils";

// ─────────────────────────────────────────────────────────────────────────────

interface LibrarySectionProps {
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
}

/**
 * Renders the main library view including collections and item grids.
 */
export function LibrarySection({
  title,
  mediaTypes,
  gridType,
  viewMode,
  onViewModeChange,
  filterRaw,
  onFilterRawChange,
  entries,
  onSelectEntry,
  onEditEntry,
  onDeleteEntry,
  onEditList,
  onDeleteList,
  onViewList,
  onOpenNewList,
}: LibrarySectionProps) {
  const { user } = useAuth();
  const uid = user?.uid || null;

  // ─── Hooks: Data & Interaction
  const { lists, listItemsById } = useLists(uid, mediaTypes);

  const { relationModal, openRelationModal, closeRelationModal } = useLibraryHandlers(entries);

  const dnd = useDragAndDrop({
    uid,
    entries,
    lists,
    listItemsById,
    onRelationDrop: openRelationModal,
  });

  const sectionEntries = useMemo(
    () => entries.filter((e) => mediaTypes.includes(e.mediaType)),
    [entries, mediaTypes],
  );

  // ─── Render Helpers
  const isListView = viewMode === "list";

  return (
    <div className="pt-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="w-full px-4 md:px-8 mb-8">
        <h1 className="text-4xl font-black tracking-tighter text-zinc-100 flex items-center gap-3">
          <Library className="w-8 h-8 text-blue-500" />
          {title}
        </h1>
      </div>

      {!uid ? (
        <div className="px-8 py-12 text-zinc-500 bg-zinc-900/20 rounded-2xl border border-zinc-800/50 mx-8">
          Sign in to access and manage your personal library.
        </div>
      ) : (
        <>
          {/* Controls Bar */}
          <div className="px-4 md:px-8 mb-8 flex flex-wrap items-center gap-4">
            <div className="inline-flex items-center gap-1 p-1 bg-zinc-900/50 border border-zinc-800 rounded-xl">
              <ViewModeButton
                active={viewMode === "list"}
                onClick={() => onViewModeChange("list")}
                icon={<List size={14} />}
                label="Collections"
              />
              <ViewModeButton
                active={viewMode === "card"}
                onClick={() => onViewModeChange("card")}
                icon={<LayoutGrid size={14} />}
                label="Grid"
              />
            </div>

            <LibrarySearchBar className="flex-grow max-w-md" />

            <button
              type="button"
              onClick={onOpenNewList}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-blue-900/20 flex items-center gap-2"
            >
              <Plus size={14} />
              New Collection
            </button>
          </div>

          {/* Main Media Content */}
          <MediaSection
            items={sectionEntries}
            getGenresThemes={(e) => e.genresThemes}
            getFilterValues={(e) => [e.releaseYear, e.userRating]}
            title="Results"
            filterRaw={filterRaw}
            onFilterRawChange={onFilterRawChange}
            showFilterInput={false}
          >
            {(filtered) => (
              <div
                className={cn(
                  "flex flex-col gap-12",
                  isListView && lists.length > 0 ? "lg:flex-row" : "",
                )}
              >
                {/* Collections (Sidebar in list view) */}
                {isListView && lists.length > 0 && (
                  <div className="lg:w-80 xl:w-96 shrink-0 space-y-6">
                    <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 px-2 flex items-center gap-2">
                      <List className="w-3 h-3" />
                      Personal Collections
                    </h2>
                    <div className="grid grid-cols-1 gap-4">
                      {lists.map((list) => (
                        <CollectionCard
                          key={list.id}
                          list={list}
                          items={listItemsById[list.id] || []}
                          activeDrop={dnd.activeDropTarget?.listId === list.id}
                          onDrop={() => dnd.handleDropOnList(list.id)}
                          onView={() => onViewList(list)}
                          onEdit={() => onEditList(list)}
                          onDelete={() => onDeleteList(list)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Entry Grids */}
                <div className="flex-1 min-w-0 space-y-8">
                  {/* ... logic for unlisted entries ... */}
                  <MediaGrid
                    className={cn(
                      "grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5",
                      isListView && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3",
                    )}
                    items={filtered.map((entry) => ({
                      ...entry,
                      year: entry.year ?? undefined,
                      onClick: () => onSelectEntry(entry),
                      onEdit: () => onEditEntry(entry),
                      onDelete: () => onDeleteEntry(entry),
                      type: gridType,
                    }))}
                    activeDragEntryId={dnd.activeDrag?.entryId ?? null}
                    onItemDragStart={dnd.handleItemDragStart}
                    onItemDragEnd={dnd.handleItemDragEnd}
                  />
                </div>
              </div>
            )}
          </MediaSection>
        </>
      )}

      {/* Overlays */}
      <RelationModal
        isOpen={!!relationModal}
        data={relationModal}
        uid={uid || ""}
        entries={entries}
        onClose={closeRelationModal}
        onSuccess={() => {}}
      />

      <RemoveDropTarget
        isVisible={!!dnd.activeDrag}
        isActive={dnd.isRemoveTargetActive}
        onDragEnter={() => {}}
        onDragOver={(e: React.DragEvent) => e.preventDefault()}
        onDragLeave={() => {}}
        onDrop={() => dnd.handleDropOnList(null)}
      />
    </div>
  );
}

// ─── Sub-components
function ViewModeButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
        active ? "bg-zinc-800 text-zinc-100 shadow-sm" : "text-zinc-500 hover:text-zinc-300",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function CollectionCard({
  list,
  items,
  activeDrop,
  onDrop,
  onView,
  onEdit,
  onDelete,
}: {
  list: ListRow;
  items: ListItemRow[];
  activeDrop: boolean;
  onDrop: () => void;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onView}
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      className={cn(
        "group relative w-full text-left p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/50 hover:bg-zinc-800/40 hover:border-zinc-700 transition-all cursor-pointer overflow-hidden",
        activeDrop && "ring-2 ring-blue-500 bg-blue-500/5 border-blue-500/50 scale-[1.02]",
      )}
    >
      <div className="relative z-10 flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <h3 className="font-bold text-zinc-100 truncate pr-8">{list.name}</h3>
            <span className="text-[10px] font-bold text-zinc-500 uppercase">
              {items.length} items
            </span>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="p-1.5 hover:text-blue-400 text-zinc-600 transition-colors"
            >
              <Pencil size={12} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-1.5 hover:text-red-400 text-zinc-600 transition-colors"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      </div>
    </button>
  );
}
