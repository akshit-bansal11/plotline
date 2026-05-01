// File: src/hooks/useHomePageHandlers.ts
// Purpose: Entry and list action handlers for the main Home page

import { useCallback, useState } from "react";
import type { EntryDoc } from "@/context/DataContext";
import type { ListRow, ListModalType } from "@/types/lists";
import { deleteLogEntry } from "@/services/log-entry";

/**
 * Hook to manage entry editing/viewing/deletion and list management actions on the Home page.
 */
export function useHomePageHandlers(uid: string | null, entries: EntryDoc[]) {
  // ─── State: Entry Modals
  const [isEditingEntry, setIsEditingEntry] = useState<EntryDoc | null>(null);
  const [viewingEntry, setViewingEntry] = useState<EntryDoc | null>(null);

  // ─── State: List Modals
  const [isListsModalOpen, setIsListsModalOpen] = useState(false);
  const [isNewListOpen, setIsNewListOpen] = useState(false);
  const [newListDefaultType, setNewListDefaultType] = useState<ListModalType>("movie");
  const [listsModalListId, setListsModalListId] = useState<string | null>(null);
  const [listsModalType, setListsModalType] = useState<ListModalType | null>(null);
  const [listsModalMode, setListsModalMode] = useState<"edit" | "delete" | "view">("view");

  // ─── Handlers: Entry
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

  const handleDeleteEntry = useCallback(
    async (entry: EntryDoc) => {
      const confirmed = confirm(`Are you sure you want to delete "${entry.title}"?`);
      if (!confirmed) return;
      try {
        if (!uid) return;
        await deleteLogEntry(uid, entry.id, entries);
      } catch (err) {
        console.error("Failed to delete entry:", err);
        alert("Failed to delete entry. Please try again.");
      }
    },
    [uid, entries],
  );

  // ─── Handlers: List
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

  const closeEntryModal = useCallback(() => {
    setIsEditingEntry(null);
    setViewingEntry(null);
  }, []);

  const closeListsModal = useCallback(() => {
    setIsListsModalOpen(false);
    setListsModalListId(null);
    setListsModalType(null);
    setListsModalMode("view");
  }, []);

  const closeNewListModal = useCallback(() => setIsNewListOpen(false), []);

  return {
    isEditingEntry,
    viewingEntry,
    handleEditEntry,
    handleViewEntry,
    handleDeleteEntry,
    closeEntryModal,
    isListsModalOpen,
    isNewListOpen,
    newListDefaultType,
    listsModalListId,
    listsModalType,
    listsModalMode,
    handleEditList,
    handleDeleteList,
    handleViewList,
    handleOpenNewList,
    closeListsModal,
    closeNewListModal,
  };
}
