// File: src/hooks/useLibraryHandlers.ts
// Purpose: Orchestrates library-specific UI logic and side effects

"use client";

// ─── React
import { useState, useCallback } from "react";

// ─── Internal — types
import type { RelationModalData } from "@/components/relations/RelationModal";
import type { EntryDoc } from "@/context/DataContext";

/**
 * Hook to manage library UI state like modals and common handlers.
 */
export function useLibraryHandlers(entries: EntryDoc[]) {
  const [relationModal, setRelationModal] = useState<RelationModalData | null>(null);
  const [statusFilter, setStatusFilter] = useState<EntryDoc["status"] | "all">("all");

  const openRelationModal = useCallback((sourceId: string, targetId: string) => {
    const source = entries.find((e) => String(e.id) === sourceId);
    const target = entries.find((e) => String(e.id) === targetId);
    
    if (source && target) {
      setRelationModal({
        sourceId,
        targetId,
        type: "Sequel",
        sourceTitle: source.title,
        targetTitle: target.title,
      });
    }
  }, [entries]);

  const closeRelationModal = useCallback(() => {
    setRelationModal(null);
  }, []);

  return {
    relationModal,
    openRelationModal,
    closeRelationModal,
    statusFilter,
    setStatusFilter,
  };
}
