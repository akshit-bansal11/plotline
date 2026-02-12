"use client";

import { useState } from "react";
import Image from "next/image";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { EntryDoc, EntryMediaType, EntryStatus } from "@/context/data-context";

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

  return (
    <Modal
      isOpen={Boolean(entry)}
      onClose={onClose}
      title="Item details"
      className="max-h-[600px] bg-neutral-900/60"
      containerClassName="w-[95%] md:w-[90%] lg:w-[80%] max-w-4xl"
    >
      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="w-full sm:w-48">
          <div className="aspect-[2/3] w-full overflow-hidden rounded-2xl bg-neutral-800/50">
            {entry.image ? (
              <Image src={entry.image} alt={entry.title} width={192} height={288} className="h-full w-full object-cover" />
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
            {onEdit ? (
              <button
                type="button"
                onClick={handleEdit}
                className="rounded-full border border-white/10 bg-neutral-900/50 px-4 py-2 text-xs font-semibold text-neutral-200 transition-colors hover:bg-neutral-900/70"
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
        </div>
      </div>
    </Modal>
  );
}
