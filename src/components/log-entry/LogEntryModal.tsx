// File: src/components/log-entry/LogEntryModal.tsx
// Purpose: Main orchestrator for viewing and editing log entries, managing state and sub-panel composition

"use client";

// ─── Icons
import { X } from "lucide-react";
// ─── React & Next
import { useCallback, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
// ─── Internal — components
import { NewListModal } from "@/components/lists/NewListModal";
import { InfographicToast } from "@/components/overlay/InfographicToast";
import { acquireModalZIndex } from "@/components/overlay/modalStack";
// ─── Internal — hooks
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useBodyScrollLock, useEscapeKey } from "@/hooks/use-log-entry";
import { useLogEntryHandlers } from "@/hooks/useLogEntryHandlers";
import { useLogEntryState } from "@/hooks/useLogEntryState";
// ─── Internal — types
import type { LoggableMedia } from "@/types/log-entry";
import { LogEntryEditLeftPanel } from "./LogEntryEditLeftPanel";
import { LogEntryFooter } from "./LogEntryFooter";
import { LogEntryRightPanel } from "./LogEntryRightPanel";
import { LogEntryViewPanel } from "./LogEntryViewPanel";

// ─────────────────────────────────────────────────────────────────────────────

export function LogEntryModal({
  isOpen,
  onClose,
  initialMedia,
  mode = "create",
}: {
  isOpen: boolean;
  onClose: () => void;
  initialMedia?: LoggableMedia | null;
  mode?: "create" | "view" | "edit";
}) {
  const { user } = useAuth();
  const { entries } = useData();
  const uid = user?.uid ?? null;

  // ─── Modular State Management
  const state = useLogEntryState({
    uid,
    isOpen,
    initialMedia,
    mode,
    entries,
  });

  const {
    isSaving,
    isRefetching,
    error,
    info,
    setInfo,
    refetchError,
    handleSave,
    handleDeleteAction,
    handleRefetchMetadata,
  } = useLogEntryHandlers();

  // ─── UI Transitions & Overlays
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isNewListOpen, setIsNewListOpen] = useState(false);
  const [duplicateToast, setDuplicateToast] = useState<{ id: number; message: string } | null>(
    null,
  );
  const modalZIndexRef = useRef<number | null>(null);

  // ─── Hooks: Lifecycle
  useBodyScrollLock(isOpen);
  useEscapeKey(isOpen, () => {
    if (showDeleteConfirm) setShowDeleteConfirm(false);
    else onClose();
  });

  // ─── Derived State
  const normalizedInitial = useMemo(() => {
    if (!initialMedia) return null;
    return {
      ...initialMedia,
      id: initialMedia.id,
    };
  }, [initialMedia]);

  // ─── Handlers
  const onRefetch = useCallback(async () => {
    await handleRefetchMetadata(state.externalId, state.mediaType, state.title, (payload) => {
      if (payload.title) state.setTitle(payload.title);
      if (payload.description) state.setDescription(payload.description);
      if (payload.image) state.setImage(payload.image);
      if (payload.releaseYear) state.setReleaseYear(payload.releaseYear);
      if (payload.director) state.setDirector(payload.director);
      if (payload.producer) state.setProducer(payload.producer);
      if (payload.genresThemes) state.setTags(payload.genresThemes);
      if (payload.imdbRating) state.setImdbRating(payload.imdbRating);
      if (payload.cast) state.setCast(payload.cast);
    });
  }, [state, handleRefetchMetadata]);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      await handleSave({
        uid,
        ...state,
        normalizedInitial,
        onSuccess: () => {
          setInfo("Saved successfully.");
          setTimeout(() => {
            setInfo(null);
            onClose();
          }, 1500);
        },
      });
    },
    [uid, state, handleSave, normalizedInitial, onClose, setInfo],
  );

  const onDelete = useCallback(async () => {
    await handleDeleteAction(
      uid,
      normalizedInitial?.id ? String(normalizedInitial.id) : undefined,
      entries,
      onClose,
    );
  }, [uid, normalizedInitial, entries, onClose, handleDeleteAction]);

  // ─── Render
  if (!isOpen || typeof document === "undefined") return null;

  if (modalZIndexRef.current === null) {
    modalZIndexRef.current = acquireModalZIndex();
  }

  const activeEntryDoc =
    state.currentMode !== "create"
      ? entries.find((e) => String(e.id) === String(normalizedInitial?.id)) || null
      : null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-6 bg-black/75 backdrop-blur-sm"
      style={{ zIndex: modalZIndexRef.current || 1000 }}
    >
      <div className="relative w-full max-w-[1200px] bg-[#0c0c0c] rounded-2xl overflow-hidden flex flex-col shadow-2xl border border-white/5 h-[90vh] max-h-[720px]">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-600 hover:text-zinc-300 transition-colors z-50"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content Area */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {state.currentMode === "view" && activeEntryDoc ? (
            <LogEntryViewPanel entry={activeEntryDoc} onEdit={() => state.setCurrentMode("edit")} />
          ) : (
            <>
              {/* Left Panel: Metadata */}
              <div className="w-1/2 border-r border-zinc-800/50">
                <LogEntryEditLeftPanel
                  state={state}
                  isRefetching={isRefetching}
                  handleRefetch={onRefetch}
                  refetchError={refetchError}
                />
              </div>

              {/* Right Panel: Progress & Tracking */}
              <div className="w-1/2">
                <LogEntryRightPanel uid={uid} state={state} setIsNewListOpen={setIsNewListOpen} />
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <LogEntryFooter
          currentMode={state.currentMode}
          isSaving={isSaving}
          isDirty={state.isDirty}
          error={error}
          info={info}
          onClose={onClose}
          onSubmit={onSubmit}
          onDelete={() => {
            if (showDeleteConfirm) {
              onDelete();
            } else {
              setShowDeleteConfirm(true);
            }
          }}
          showDeleteConfirm={showDeleteConfirm}
        />
      </div>

      {/* Modals & Toasts */}
      <NewListModal
        isOpen={isNewListOpen}
        onClose={() => setIsNewListOpen(false)}
        defaultType={state.mediaType}
        onCreated={(list) => state.setSelectedListIds((prev) => new Set([...prev, list.id]))}
      />
      <InfographicToast
        isOpen={Boolean(duplicateToast)}
        title="Duplicate Detected"
        message={duplicateToast?.message ?? ""}
        onClose={() => setDuplicateToast(null)}
      />
    </div>,
    document.body,
  );
}
