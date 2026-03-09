"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown } from "lucide-react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { Modal } from "@/components/ui/Modal";
import { ImageWithSkeleton } from "@/components/ui/ImageWithSkeleton";
import { cn, entryMediaTypeLabels, entryStatusLabels } from "@/lib/utils";
import { EntryDoc, EntryMediaType, EntryStatus, useData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { DescriptionErrorWrapper } from "@/components/ui/DescriptionErrorWrapper";
import { MAX_DESCRIPTION_LENGTH_MANUAL } from "@/lib/validation";

const statusLabels: Record<EntryStatus, string> = entryStatusLabels;
const mediaTypeLabels: Record<EntryMediaType, string> = entryMediaTypeLabels;

const formatDate = (value: number | null) => {
  if (!value) return "";
  return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

export function EntryDetailModal({
  entry,
  onClose,
  onEdit,
  onDelete,
}: {
  entry: EntryDoc | null;
  onClose: () => void;
  onEdit?: (entry: EntryDoc) => void;
  onDelete?: (entry: EntryDoc) => Promise<boolean> | boolean;
}) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionInfo, setActionInfo] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement | null>(null);
  const { user } = useAuth();
  const uid = user?.uid || null;
  const { entries } = useData();

  useEffect(() => {
    if (!isStatusOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(event.target as Node)) {
        setIsStatusOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isStatusOpen]);
  if (!entry) return null;
  const subtitle = [entry.releaseYear, mediaTypeLabels[entry.mediaType], statusLabels[entry.status]].filter(Boolean).join(" • ");
  const completionValue =
    entry.status === "completed"
      ? entry.completionDateUnknown
        ? "Unknown"
        : formatDate(entry.completedAtMs)
      : "";

  const handleEdit = () => {
    setActionError(null);
    setActionInfo(null);
    onEdit?.(entry);
    onClose();
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setActionError(null);
    setActionInfo(null);
    if (!confirm(`Delete "${entry.title}"? This cannot be undone.`)) {
      return;
    }
    setIsWorking(true);
    try {
      const result = await onDelete(entry);
      if (result === false) {
        setActionError("Failed to delete item.");
      } else {
        setActionInfo("Item deleted.");
        setTimeout(() => onClose(), 600);
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to delete item.");
    } finally {
      setIsWorking(false);
    }
  };

  const STANDARD_STATUS_OPTIONS: EntryStatus[] = ["watching", "completed", "plan_to_watch", "on_hold", "dropped", "unspecified"];
  const GAME_STATUS_OPTIONS: EntryStatus[] = ["not_committed", "committed", "main_story_completed", "fully_completed", "backlogged", "bored", "own", "wishlist", "dropped", "unspecified"];
  const statusOptions = entry?.mediaType === "game" ? GAME_STATUS_OPTIONS : STANDARD_STATUS_OPTIONS;

  const getStatusBadgeClass = (value: EntryStatus) => {
    if (entry?.mediaType === "game") {
      switch (value) {
        case "main_story_completed":
          return "border-emerald-700/50 bg-emerald-950/80 text-emerald-600 hover:bg-emerald-900/80";
        case "fully_completed":
          return "border-emerald-400/50 bg-emerald-950/80 text-emerald-300 hover:bg-emerald-900/80";
        case "backlogged":
          return "border-yellow-500/50 bg-yellow-950/80 text-yellow-400 hover:bg-yellow-900/80";
        case "bored":
          return "border-orange-500/50 bg-orange-950/80 text-orange-400 hover:bg-orange-900/80";
        case "own":
          return "border-pink-500/50 bg-pink-950/80 text-pink-400 hover:bg-pink-900/80";
        case "wishlist":
          return "border-white/50 bg-neutral-950/80 text-white hover:bg-neutral-900/80";
        case "committed":
          return "border-sky-500/50 bg-sky-950/80 text-sky-400 hover:bg-sky-900/80";
        case "not_committed":
          return "border-blue-700/50 bg-blue-950/80 text-blue-500 hover:bg-blue-900/80";
        case "dropped":
          return "border-red-500/50 bg-red-950/80 text-red-400 hover:bg-red-900/80";
        default:
          return "border-neutral-500/30 bg-neutral-950/80 text-neutral-400 hover:bg-neutral-900/80";
      }
    }
    switch (value) {
      case "completed":
        return "border-emerald-500/50 bg-emerald-950/80 text-emerald-400 hover:bg-emerald-900/80";
      case "watching":
        return "border-blue-500/50 bg-blue-950/80 text-blue-400 hover:bg-blue-900/80";
      case "plan_to_watch":
        return "border-violet-500/50 bg-violet-950/80 text-violet-400 hover:bg-violet-900/80";
      case "on_hold":
        return "border-yellow-500/50 bg-yellow-950/80 text-yellow-400 hover:bg-yellow-900/80";
      case "dropped":
        return "border-red-500/50 bg-red-950/80 text-red-400 hover:bg-red-900/80";
      default:
        return "border-neutral-500/30 bg-neutral-950/80 text-neutral-400 hover:bg-neutral-900/80";
    }
  };

  const handleStatusChange = async (next: EntryStatus) => {
    if (!uid) return;
    if (entry.status === next) {
      setIsStatusOpen(false);
      return;
    }
    setIsStatusUpdating(true);
    setActionError(null);
    setActionInfo(null);
    try {
      await updateDoc(doc(db, "users", uid, "entries", entry.id), {
        status: next,
        updatedAt: serverTimestamp(),
      });
      setIsStatusOpen(false);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to update status.");
    } finally {
      setIsStatusUpdating(false);
    }
  };

  return (
    <Modal
      isOpen={Boolean(entry)}
      onClose={onClose}
      title="Item details"
      className="max-h-[600px] bg-neutral-900/60"
      containerClassName="w-[95%] md:w-[90%] lg:w-[80%] max-w-4xl"
    >
      <DescriptionErrorWrapper
        isInvalid={!!entry && !!entry.description && entry.description.length > MAX_DESCRIPTION_LENGTH_MANUAL}
        actions={
          !!entry && !!entry.description && entry.description.length > MAX_DESCRIPTION_LENGTH_MANUAL && (
            <div className="absolute inset-x-0 bottom-4 flex justify-center gap-3 z-30 pointer-events-auto">
              {onEdit ? (
                <button
                  type="button"
                  onClick={handleEdit}
                  className="rounded-full border border-white/10 bg-blue-500 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-600 shadow-xl"
                >
                  Edit
                </button>
              ) : null}
              {onDelete ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isWorking}
                  className={cn(
                    "rounded-full border border-red-400 bg-red-500 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-600 shadow-xl",
                    isWorking ? "cursor-not-allowed opacity-70" : ""
                  )}
                >
                  {isWorking ? "Deleting..." : "Delete"}
                </button>
              ) : null}
            </div>
          )
        }
      >
        <div className="relative flex flex-col gap-6 sm:flex-row p-4 min-h-[300px]">
          {entry.status !== "unspecified" ? (
            <div
              className="absolute right-0 top-0"
              ref={statusMenuRef}
              onMouseEnter={() => setIsStatusOpen(true)}
              onMouseLeave={() => setIsStatusOpen(false)}
            >
              <button
                type="button"
                onClick={() => setIsStatusOpen((prev) => !prev)}
                disabled={isStatusUpdating}
                className={cn(
                  "group/status mt-1 mr-1 flex items-center gap-2 rounded-full border backdrop-blur-md px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-all duration-300",
                  getStatusBadgeClass(entry.status),
                  isStatusUpdating ? "cursor-not-allowed opacity-70" : "cursor-pointer"
                )}
                aria-haspopup="listbox"
                aria-expanded={isStatusOpen}
                aria-label="Change status"
              >
                <span>{isStatusUpdating ? "Updating..." : statusLabels[entry.status]}</span>
                <ChevronDown
                  size={14}
                  className={cn(
                    "transition-transform duration-300 ease-in-out text-current/70 group-hover/status:text-current",
                    isStatusOpen ? "rotate-180" : ""
                  )}
                  suppressHydrationWarning
                />
              </button>
              <AnimatePresence>
                {isStatusOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 4, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.96 }}
                    transition={{ duration: 0.2 }}
                    className="absolute right-0 mt-2 w-40 rounded-xl border border-white/10 bg-neutral-950/95 backdrop-blur-xl p-2 shadow-xl"
                  >
                    {statusOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => handleStatusChange(option)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors",
                          option === entry.status
                            ? "bg-white/10 text-white"
                            : "text-neutral-300 hover:bg-white/5"
                        )}
                      >
                        <span>{statusLabels[option]}</span>
                        {option === entry.status && (
                          <div className="h-1 w-1 rounded-full bg-current" />
                        )}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : null}
          <div className="w-full sm:w-48">
            <div className="aspect-[2/3] w-full overflow-hidden rounded-2xl bg-neutral-800/50">
              {entry.image ? (
                <ImageWithSkeleton src={entry.image} alt={entry.title} width={192} height={288} className="h-full w-full object-cover" />
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
            <div className="flex flex-wrap gap-2">
              {onEdit && (!entry.description || entry.description.length <= MAX_DESCRIPTION_LENGTH_MANUAL) ? (
                <button
                  type="button"
                  onClick={handleEdit}
                  className="rounded-full border border-white/10 bg-neutral-900/50 px-4 py-2 text-xs font-semibold text-neutral-200 transition-colors hover:bg-neutral-900/70"
                >
                  Edit
                </button>
              ) : null}
              {onDelete && (!entry.description || entry.description.length <= MAX_DESCRIPTION_LENGTH_MANUAL) ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isWorking}
                  className={cn(
                    "rounded-full border border-red-400/20 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-200 transition-colors hover:bg-red-500/20",
                    isWorking ? "cursor-not-allowed opacity-70" : ""
                  )}
                >
                  {isWorking ? "Deleting..." : "Delete"}
                </button>
              ) : null}
            </div>
            {actionError ? <div className="text-sm text-red-400">{actionError}</div> : null}
            {actionInfo ? <div className="text-sm text-emerald-300">{actionInfo}</div> : null}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {entry.userRating !== null ? (
                <div className="rounded-xl border border-white/5 bg-neutral-900/40 px-3 py-2 text-xs text-neutral-300">
                  Your rating: {entry.userRating}/10
                </div>
              ) : null}
              {entry.imdbRating !== null ? (
                <div className="rounded-xl border border-white/5 bg-neutral-900/40 px-3 py-2 text-xs text-neutral-300">
                  IMDb rating: {entry.imdbRating}/10
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
            {entry.relations && entry.relations.length > 0 ? (
              <div className="space-y-2 pt-2 border-t border-white/5">
                <div className="text-sm font-medium text-neutral-300">Related Entries</div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {entry.relations.map((rel, idx) => {
                    const match = entries.find(e => String(e.id) === rel.targetId);
                    return (
                      <div key={idx} className="flex flex-col rounded-lg border border-white/5 bg-neutral-900/40 px-3 py-2">
                        <span className="text-[10px] text-neutral-500 font-medium uppercase tracking-wider">{rel.type}</span>
                        <span className="text-xs text-neutral-200 truncate">{match ? match.title : "Unknown Entry"}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </DescriptionErrorWrapper>
    </Modal>
  );
}
