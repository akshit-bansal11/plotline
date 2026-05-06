// File: src/hooks/useLogEntryHandlers.ts
// Purpose: Orchestrates async actions for log entries: saving, deleting, and refetching metadata

"use client";

// ─── Firebase
import { serverTimestamp, Timestamp } from "firebase/firestore";
// ─── React
import { useCallback, useState } from "react";
// ─── Internal — types
import type { EntryDoc } from "@/context/DataContext";
// ─── Internal — services
import { deleteLogEntry, saveLogEntry } from "@/services/log-entry";
import type {
  EditableRelation,
  EntryMediaType,
  EntryStatusValue,
  LogEntryData,
  LoggableMedia,
} from "@/types/log-entry";
import { isCompletionStatus } from "@/types/log-entry";

// ─── Internal — utils
import { parseISODate } from "@/utils/log-entry";

export interface HandleSaveOptions {
  uid: string | null;
  currentMode: "create" | "view" | "edit";
  normalizedInitial:
    | (LoggableMedia & { inferredType?: EntryMediaType; inferredIsMovie?: boolean })
    | null;
  title: string;
  mediaType: EntryMediaType;
  status: EntryStatusValue;
  userRating: string;
  image: string | null;
  completionUnknown: boolean;
  completionDate: string;
  selectedListIds: Set<string>;
  initialListIds: Set<string>;
  relations: EditableRelation[];
  originalRelations: { targetId: string; type: string; createdAtMs: number }[];
  currentEpisodes: number;
  episodeCount: string;
  currentSeasons: number;
  totalSeasons: number;
  currentChapters: number;
  chapterCount: string;
  currentVolumes: number;
  volumeCount: number;
  rewatchCount: number;
  startDate: string;
  playTime: string;
  platform: string;
  description: string;
  releaseYear: string;
  director: string;
  producer: string;
  tags: string[];
  imdbRating: string;
  cast: string[];
  externalId: string | null;
  onSuccess: () => void;
  isMovie?: boolean;
}

export interface MetadataPayload {
  title?: string;
  description?: string;
  image?: string | null;
  releaseYear?: string;
  director?: string;
  producer?: string;
  genresThemes?: string[];
  imdbRating?: string;
  cast?: string[];
  playTime?: string;
  platform?: string;
}

/**
 * Hook to handle submission, deletion, and metadata refetching for log entries.
 */
export function useLogEntryHandlers() {
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [refetchError, setRefetchError] = useState<string | null>(null);

  const handleSave = useCallback(async (options: HandleSaveOptions) => {
    const {
      uid,
      currentMode,
      normalizedInitial,
      title,
      mediaType,
      status,
      userRating,
      image,
      completionUnknown,
      completionDate,
      selectedListIds,
      initialListIds,
      relations,
      originalRelations,
      currentEpisodes,
      episodeCount,
      currentSeasons,
      totalSeasons,
      currentChapters,
      chapterCount,
      currentVolumes,
      volumeCount,
      rewatchCount,
      startDate,
      playTime,
      platform,
      description,
      releaseYear,
      director,
      producer,
      tags,
      imdbRating,
      cast,
      externalId,
      onSuccess,
    } = options;

    if (!uid) return;
    setError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Title is required.");
      return;
    }

    setIsSaving(true);
    try {
      let completedAt: Timestamp | null = null;
      if (isCompletionStatus(status) && !completionUnknown) {
        const parsed = parseISODate(completionDate);
        if (parsed) completedAt = Timestamp.fromDate(parsed.date);
      }

      const relationPayload = relations.map((r) => ({
        targetId: r.targetId,
        type: r.type,
        createdAtMs: r.createdAtMs || Date.now(),
      }));

      const entryData: LogEntryData = {
        title: trimmedTitle,
        mediaType,
        status,
        userRating: userRating ? Number(userRating) : null,
        image,
        completedAt,
        completionDateUnknown: completionUnknown,
        listIds: Array.from(selectedListIds),
        relations: relationPayload,
        currentEpisodes,
        episodeCount: episodeCount ? Number(episodeCount) : null,
        currentSeasons,
        totalSeasons,
        currentChapters,
        chapterCount: chapterCount ? Number(chapterCount) : null,
        currentVolumes,
        volumeCount,
        rewatchCount,
        startDate,
        playTime: playTime ? Number(playTime) : null,
        platform: platform || null,
        description,
        releaseYear: releaseYear || null,
        year: releaseYear || null,
        director,
        producer,
        genresThemes: tags,
        imdbRating: imdbRating ? Number(imdbRating) : null,
        cast,
        externalId: externalId || normalizedInitial?.externalId || null,
        isMovie: options.isMovie || false,
        lengthMinutes: null,
        achievements: null,
        totalAchievements: null,
        updatedAt: serverTimestamp(),
      };

      await saveLogEntry({
        uid,
        isEditing: currentMode !== "create",
        entryId: currentMode !== "create" ? String(normalizedInitial?.id) : null,
        entryData,
        trimmedTitle,
        listMediaType: mediaType,
        image,
        releaseYearValue: releaseYear,
        selectedListIds,
        initialListIds,
        originalRelations,
        relationPayload,
      });

      setInfo("Saved successfully.");
      onSuccess();
    } catch (_err) {
      console.error(_err);
      setError("Failed to save.");
    } finally {
      setIsSaving(false);
    }
  }, []);

  const handleDeleteAction = useCallback(
    async (
      uid: string | null,
      entryId: string | undefined,
      entries: EntryDoc[],
      onSuccess: () => void,
    ) => {
      if (!uid || !entryId) return;
      setIsDeleting(true);
      try {
        await deleteLogEntry(uid, entryId, entries);
        onSuccess();
      } catch (_err) {
        setError("Failed to delete.");
        setIsDeleting(false);
      }
    },
    [],
  );

  const handleRefetchMetadata = useCallback(
    async (
      externalId: string | null,
      mediaType: EntryMediaType,
      title: string,
      applyMetadata: (data: MetadataPayload) => void,
    ) => {
      if (!externalId) return;
      setIsRefetching(true);
      setRefetchError(null);
      try {
        const response = await fetch(
          `/api/metadata?type=${mediaType}&id=${externalId}&title=${encodeURIComponent(title)}`,
        );
        const payload = await response.json();
        if (payload.data) {
          applyMetadata(payload.data);
          setInfo("Metadata updated.");
          setTimeout(() => setInfo(null), 3000);
        }
      } catch (_err) {
        setRefetchError("Refetch failed.");
      } finally {
        setIsRefetching(false);
      }
    },
    [],
  );

  return {
    isSaving,
    isDeleting,
    isRefetching,
    error,
    setError,
    info,
    setInfo,
    refetchError,
    setRefetchError,
    handleSave,
    handleDeleteAction,
    handleRefetchMetadata,
  };
}
