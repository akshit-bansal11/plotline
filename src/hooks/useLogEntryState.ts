// File: src/hooks/useLogEntryState.ts
// Purpose: Manages state, initialization, and dirty tracking for log entries

"use client";

// ─── React
import { useEffect, useMemo, useRef, useState } from "react";

// ─── Internal — hooks
import { useInitialListIds, useLists } from "@/hooks/use-log-entry";

// ─── Internal — types
import type { EntryDoc } from "@/context/DataContext";
import type {
  EditableRelation,
  EntryMediaType,
  EntryStatusValue,
  LoggableMedia,
} from "@/types/log-entry";
import { isCompletionStatus } from "@/types/log-entry";
import type { RelationType } from "@/services/relations";

// ─── Internal — utils
import {
  buildEditableRelations,
  formatISODate,
} from "@/utils/log-entry";

interface LogEntryStateOptions {
  uid: string | null;
  isOpen: boolean;
  initialMedia?: LoggableMedia | null;
  mode: "create" | "view" | "edit";
  entries: EntryDoc[];
}

/**
 * Hook to manage the complex state of a log entry.
 */
export function useLogEntryState({
  uid,
  isOpen,
  initialMedia,
  mode,
  entries,
}: LogEntryStateOptions) {
  // ─── Core State
  const [currentMode, setCurrentMode] = useState(mode);
  
  // ─── Metadata State
  const [title, setTitle] = useState("");
  const [mediaType, setMediaType] = useState<EntryMediaType>("movie");
  const [isMovie, setIsMovie] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [externalId, setExternalId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [releaseYear, setReleaseYear] = useState("");
  const [director, setDirector] = useState("");
  const [producer, setProducer] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [imdbRating, setImdbRating] = useState("");
  const [cast, setCast] = useState<string[]>([]);
  const [playTime, setPlayTime] = useState("");
  const [platform, setPlatform] = useState("");
  const [activeField, setActiveField] = useState<string | null>(null);
  
  // ─── Progress State
  const [status, setStatus] = useState<EntryStatusValue>("unspecified");
  const [userRating, setUserRating] = useState("");
  const [currentEpisodes, setCurrentEpisodes] = useState(0);
  const [episodeCount, setEpisodeCount] = useState("");
  const [currentSeasons, setCurrentSeasons] = useState(0);
  const [totalSeasons, setTotalSeasons] = useState(0);
  const [currentChapters, setCurrentChapters] = useState(0);
  const [chapterCount, setChapterCount] = useState("");
  const [currentVolumes, setCurrentVolumes] = useState(0);
  const [volumeCount, setVolumeCount] = useState(0);
  const [rewatchCount, setRewatchCount] = useState(0);
  const [playTime, setPlayTime] = useState("");
  const [platform, setPlatform] = useState("");
  const [startDate, setStartDate] = useState("");
  const [completionDate, setCompletionDate] = useState("");
  const [completionUnknown, setCompletionUnknown] = useState(false);
  
  // ─── Lists & Relations State
  const [selectedListIds, setSelectedListIds] = useState<Set<string>>(new Set());
  const [initialListIds, setInitialListIds] = useState<Set<string>>(new Set());
  const [relations, setRelations] = useState<EditableRelation[]>([]);
  const [originalRelations, setOriginalRelations] = useState<{ targetId: string; type: string; createdAtMs: number }[]>([]);
  const [relationQuery, setRelationQuery] = useState("");
  const [selectedRelationDoc, setSelectedRelationDoc] = useState<EntryDoc | null>(null);
  const [selectedRelationType, setSelectedRelationType] = useState<RelationType>("Sequel");

  const initializedRef = useRef<string | number | null>(null);
  const snapshotRef = useRef<any>(null);

  // ─── Hooks: Lists
  const lists = useLists(uid, isOpen);
  useInitialListIds(
    uid,
    isOpen,
    currentMode !== "create",
    initialMedia?.id,
    initialMedia?.listIds,
    lists,
    setSelectedListIds,
    setInitialListIds
  );

  const availableLists = useMemo(
    () => lists.filter((l) => l.types.includes(mediaType)),
    [lists, mediaType]
  );

  const normalizedInitial = useMemo(() => {
    if (!initialMedia) return null;
    const inferredType: EntryMediaType =
      initialMedia.type === "anime" || initialMedia.type === "anime_movie"
        ? "anime"
        : (initialMedia.type as EntryMediaType);
    return {
      ...initialMedia,
      inferredType,
      inferredIsMovie: initialMedia.type === "anime_movie" || initialMedia.isMovie,
    };
  }, [initialMedia]);

  // ─── Initialization Effect
  useEffect(() => {
    if (!isOpen) {
      initializedRef.current = null;
      return;
    }

    if (isOpen) {
      setCurrentMode(mode);
    }

    if (normalizedInitial) {
      if (normalizedInitial.id && initializedRef.current === normalizedInitial.id) return;
      initializedRef.current = normalizedInitial.id;

      const entryDoc = currentMode !== "create" 
        ? (entries.find(e => String(e.id) === String(normalizedInitial.id)) ?? null)
        : null;

      // Reset state
      setTitle(normalizedInitial.title);
      setMediaType(normalizedInitial.inferredType);
      setIsMovie(!!normalizedInitial.inferredIsMovie);
      setImage(normalizedInitial.image ?? null);
      setExternalId(entryDoc?.externalId ? String(entryDoc.externalId) : (normalizedInitial.id ? String(normalizedInitial.id) : null));
      setDescription(normalizedInitial.description ?? "");
      setReleaseYear(normalizedInitial.releaseYear ?? normalizedInitial.year ?? "");
      setDirector(normalizedInitial.director ?? entryDoc?.director ?? "");
      setProducer(normalizedInitial.producer ?? entryDoc?.producer ?? "");
      setTags(Array.isArray(normalizedInitial.genresThemes) ? normalizedInitial.genresThemes.slice(0, 10) : []);
      setCast(Array.isArray(normalizedInitial.cast) ? normalizedInitial.cast : (entryDoc?.cast || []));
      setPlayTime(entryDoc?.playTime || normalizedInitial.playTime || "");
      setPlatform(entryDoc?.platform || normalizedInitial.platform || "");

      const uRating = normalizedInitial.userRating ?? normalizedInitial.rating ?? null;
      setUserRating(uRating != null ? String(uRating) : "");
      
      const iRating = normalizedInitial.imdbRating ?? normalizedInitial.rating ?? null;
      setImdbRating(iRating != null ? String(iRating) : "");
      
      setStatus(normalizedInitial.status ?? "unspecified");
      setStartDate(entryDoc?.startDate ?? "");
      
      if (isCompletionStatus(normalizedInitial.status ?? "unspecified")) {
        if (normalizedInitial.completionDateUnknown) setCompletionUnknown(true);
        else if (normalizedInitial.completedAt) setCompletionDate(formatISODate(normalizedInitial.completedAt));
        else setCompletionDate("");
      } else {
        setCompletionDate("");
        setCompletionUnknown(false);
      }

      setCurrentEpisodes(entryDoc?.currentEpisodes ?? 0);
      setEpisodeCount(normalizedInitial.episodeCount ? String(normalizedInitial.episodeCount) : "");
      setCurrentSeasons(entryDoc?.currentSeasons ?? 0);
      setTotalSeasons(entryDoc?.totalSeasons ?? 0);
      setCurrentChapters(entryDoc?.currentChapters ?? 0);
      setChapterCount(normalizedInitial.chapterCount ? String(normalizedInitial.chapterCount) : "");
      setRewatchCount(entryDoc?.rewatchCount ?? 0);

      if (normalizedInitial.relations) {
        const cleaned = normalizedInitial.relations
          .filter(r => !r.inferred)
          .map(r => ({
            targetId: String(r.targetId || "").trim(),
            type: String(r.type || "").trim(),
            createdAtMs: r.createdAtMs || Date.now()
          }))
          .filter(r => r.targetId && r.type);
        setOriginalRelations(cleaned);
        setRelations(buildEditableRelations(cleaned, entries));
      }

      // Snapshot for dirty tracking
      snapshotRef.current = {
        title: normalizedInitial.title,
        status: normalizedInitial.status ?? "unspecified",
        userRating: uRating != null ? String(uRating) : "",
        platform: entryDoc?.platform ?? normalizedInitial.platform ?? "",
        playTime: entryDoc?.playTime ?? normalizedInitial.playTime ?? "",
        description: normalizedInitial.description ?? "",
        releaseYear: normalizedInitial.releaseYear ?? normalizedInitial.year ?? "",
        director: normalizedInitial.director ?? entryDoc?.director ?? "",
        producer: normalizedInitial.producer ?? entryDoc?.producer ?? "",
        imdbRating: iRating != null ? String(iRating) : "",
        cast: Array.isArray(normalizedInitial.cast) ? normalizedInitial.cast : (entryDoc?.cast || []),
        tags: Array.isArray(normalizedInitial.genresThemes) ? normalizedInitial.genresThemes.slice(0, 10) : []
      };
    }
  }, [isOpen, normalizedInitial, entries, mode]);

  // ─── Dirty Tracking logic
  const isDirty = useMemo(() => {
    if (!snapshotRef.current) return false;
    const snap = snapshotRef.current;
    return (
      title !== snap.title ||
      status !== snap.status ||
      userRating !== snap.userRating ||
      platform !== snap.platform ||
      playTime !== snap.playTime ||
      description !== snap.description ||
      releaseYear !== snap.releaseYear ||
      director !== snap.director ||
      producer !== snap.producer ||
      imdbRating !== snap.imdbRating ||
      JSON.stringify(cast) !== JSON.stringify(snap.cast) ||
      JSON.stringify(tags) !== JSON.stringify(snap.tags)
    );
  }, [title, status, userRating, platform, playTime, description, releaseYear, director, producer, imdbRating, cast, tags]);

  return {
    currentMode, setCurrentMode,
    title, setTitle,
    mediaType, setMediaType,
    isMovie, setIsMovie,
    image, setImage,
    externalId, setExternalId,
    description, setDescription,
    releaseYear, setReleaseYear,
    director, setDirector,
    producer, setProducer,
    tags, setTags,
    imdbRating, setImdbRating,
    cast, setCast,
    activeField, setActiveField,
    status, setStatus,
    userRating, setUserRating,
    currentEpisodes, setCurrentEpisodes,
    episodeCount, setEpisodeCount,
    currentSeasons, setCurrentSeasons,
    totalSeasons, setTotalSeasons,
    currentChapters, setCurrentChapters,
    chapterCount, setChapterCount,
    currentVolumes, setCurrentVolumes,
    volumeCount, setVolumeCount,
    rewatchCount, setRewatchCount,
    playTime, setPlayTime,
    platform, setPlatform,
    startDate, setStartDate,
    completionDate, setCompletionDate,
    completionUnknown, setCompletionUnknown,
    selectedListIds, setSelectedListIds,
    initialListIds, setInitialListIds,
    relations, setRelations,
    originalRelations, setOriginalRelations,
    relationQuery, setRelationQuery,
    selectedRelationDoc, setSelectedRelationDoc,
    selectedRelationType, setSelectedRelationType,
    isDirty,
    availableLists,
    lists,
    entries,
  };
}
