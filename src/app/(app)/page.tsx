"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useMemo, useState } from "react";
import { DashboardSection } from "@/components/dashboard/DashboardSection";
import { LibrarySection } from "@/components/library/LibrarySection";
import { MyListsModal } from "@/components/lists/MyListsModal";
import { NewListModal } from "@/components/lists/NewListModal";
import { LogEntryModal } from "@/components/log-entry/LogEntryModal";
import { sectionConfigs } from "@/config/navigation";
import { useAuth } from "@/context/AuthContext";
import { type EntryDoc, useData } from "@/context/DataContext";
import { type SectionKey, useSection } from "@/context/SectionContext";
import { deleteLogEntry } from "@/services/log-entry";
import type { ListModalType, ListRow } from "@/types/lists";

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
        onOpenEntry={(entryId) => {
          const entry = entries.find((candidate) => String(candidate.id) === String(entryId));
          if (entry) handleViewEntry(entry);
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
