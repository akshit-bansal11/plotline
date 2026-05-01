// File: src/app/(app)/page.tsx
// Purpose: Main application landing page orchestrating dashboard and library sections

"use client";

// ─── React
import { useCallback, useMemo, useState } from "react";

// ─── Third-party
import { AnimatePresence, motion } from "motion/react";

// ─── Internal — components
import { DashboardSection } from "@/components/dashboard/DashboardSection";
import { LibrarySection } from "@/components/library/LibrarySection";
import { MyListsModal } from "@/components/lists/MyListsModal";
import { NewListModal } from "@/components/lists/NewListModal";
import { LogEntryModal } from "@/components/log-entry/LogEntryModal";

// ─── Internal — config
import { sectionConfigs } from "@/config/navigation";

// ─── Internal — context
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { type SectionKey, useSection } from "@/context/SectionContext";

// ─── Internal — types
import type { ListModalType } from "@/types/lists";

// ─── Internal — hooks
import { useHomePageHandlers } from "@/hooks/useHomePageHandlers";

export default function Home() {
  // ─── Hooks: Context
  const { user } = useAuth();
  const { activeSection } = useSection();
  const { entries, status, error, refresh } = useData();
  const uid = user?.uid || null;

  // ─── Hooks: Handlers
  const {
    isEditingEntry, viewingEntry, handleEditEntry, handleViewEntry, handleDeleteEntry, closeEntryModal,
    isListsModalOpen, isNewListOpen, newListDefaultType, listsModalListId, listsModalType, listsModalMode,
    handleEditList, handleDeleteList, handleViewList, handleOpenNewList, closeListsModal, closeNewListModal,
  } = useHomePageHandlers(uid, entries);

  // ─── State: UI Local
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

  // ─── Handlers: Local UI
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

  // ─── Render: Section Node
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
        onClose={closeEntryModal}
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
        onClose={closeListsModal}
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
        onClose={closeNewListModal}
        defaultType={newListDefaultType}
      />
    </>
  );
}
  );
}
