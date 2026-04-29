"use client";

// ─── Firebase ────────────────────────────────────────────────────────────────
import { serverTimestamp, Timestamp } from "firebase/firestore";

// ─── Icons ────────────────────────────────────────────────────────────────────
import { ChevronDown, RefreshCw, Search, X } from "lucide-react";

// ─── Next & React ────────────────────────────────────────────────────────────────────
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

// ─── Internal imports ─────────────────────────────────────────────────────────
import { NewListModal } from "@/components/lists/NewListModal";
import { InfographicToast } from "@/components/overlay/InfographicToast";
import { CustomDropdown } from "@/components/ui/CustomDropdown";
import { StarRating } from "@/components/ui/StarRating";
import { useAuth } from "@/context/AuthContext";
import { type EntryDoc, useData } from "@/context/DataContext";
import { deleteLogEntry, saveLogEntry } from "@/services/log-entry";
import { RELATION_OPTIONS, type RelationType } from "@/services/relations";
import { cn, entryMediaTypeLabels, entryStatusLabels } from "@/utils";
import { getLogEntryStatusOptions } from "../../data/log-entry";
import { isCompletionStatus } from "../../types/log-entry";
import {
  useBodyScrollLock,
  useEscapeKey,
  useInitialListIds,
  useLists,
} from "../../hooks/use-log-entry";
// ─── Refactored modules ───────────────────────────────────────────────────────
import type {
  EditableRelation,
  EntryMediaType,
  EntryStatusValue,
  LoggableMedia,
} from "../../types/log-entry";
import { isCompletionStatus } from "../../types/log-entry";
import {
  buildEditableRelations,
  formatISODate,
  parseISODate,
  todayISODate,
} from "../../utils/log-entry";
import { acquireModalZIndex } from "../overlay/modalStack";
import { InlineEditable } from "./InlineEditable";
import { SectionHeader } from "./SectionHeader";
import { StatColumn } from "./StatColumn";
import { Stepper } from "./Stepper";

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
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

  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [currentMode, setCurrentMode] = useState(mode);

  // ── HOOKS ──────────────────────────────────────────────────────────────────
  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (isOpen) {
      setCurrentMode(mode);
    }
  }, [isOpen, mode]);

  const handleClose = () => {
    if (showDeleteConfirm) {
      setShowDeleteConfirm(false);
      return;
    }
    onClose();
  };

  useEscapeKey(isOpen, handleClose);

  // ── STATE ──────────────────────────────────────────────────────────────────
  const [activeField, setActiveField] = useState<string | null>(null);

  // Core media fields
  const [title, setTitle] = useState("");
  const [mediaType, setMediaType] = useState<EntryMediaType>("movie");
  const [isMovie, setIsMovie] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [externalId, setExternalId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [releaseYear, setReleaseYear] = useState("");
  const [director, setDirector] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [imdbRating, setImdbRating] = useState("");

  // Numeric counts
  const [episodeCount, setEpisodeCount] = useState("");
  const [chapterCount, setChapterCount] = useState("");
  const [lengthMinutes, setLengthMinutes] = useState("");

  // User-progress fields
  const [status, setStatus] = useState<EntryStatusValue>("unspecified");
  const [userRating, setUserRating] = useState("");
  const [currentEpisodes, setCurrentEpisodes] = useState(0);
  const [currentSeasons, setCurrentSeasons] = useState(0);
  const [totalSeasons, setTotalSeasons] = useState(0);
  const [currentChapters, setCurrentChapters] = useState(0);
  const [rewatchCount, setRewatchCount] = useState(0);

  // Game fields
  const [playTime, setPlayTime] = useState("");
  const [achievements, setAchievements] = useState("");
  const [totalAchievements, setTotalAchievements] = useState("");
  const [platform, setPlatform] = useState("");
  const [producer, setProducer] = useState("");
  const [cast, setCast] = useState<string[]>([]);

  // Manga specific
  const [currentVolumes, setCurrentVolumes] = useState(0);
  const [volumeCount, setVolumeCount] = useState(0);

  // Dates
  const [startDate, setStartDate] = useState("");
  const [completionDate, setCompletionDate] = useState("");
  const [completionUnknown, setCompletionUnknown] = useState(false);

  // Lists
  const [selectedListIds, setSelectedListIds] = useState<Set<string>>(new Set());
  const [initialListIds, setInitialListIds] = useState<Set<string>>(new Set());
  const [isNewListOpen, setIsNewListOpen] = useState(false);

  // Relations
  const [originalRelations, setOriginalRelations] = useState<
    { targetId: string; type: string; createdAtMs: number }[]
  >([]);
  const [relations, setRelations] = useState<EditableRelation[]>([]);
  const [relationQuery, setRelationQuery] = useState("");
  const [selectedRelationDoc, setSelectedRelationDoc] = useState<EntryDoc | null>(null);
  const [selectedRelationType, setSelectedRelationType] = useState<RelationType>("Sequel");

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [refetchError, setRefetchError] = useState<string | null>(null);
  const [duplicateToast, setDuplicateToast] = useState<{ id: number; message: string } | null>(
    null,
  );
  const tagRef = useRef<HTMLInputElement>(null);
  const castRef = useRef<HTMLInputElement>(null);
  const modalZIndexRef = useRef<number | null>(null);

  // ── DYNAMIC FONT SIZES ─────────────────────────────────────────────────────

  const titleFontSize = useMemo(() => {
    const len = title.length;
    if (len <= 12) return "text-3xl";
    if (len <= 24) return "text-2xl";
    if (len <= 45) return "text-xl";
    return "text-lg";
  }, [title]);

  // ── UI ADAPTATION HELPERS ──────────────────────────────────────────────────

  const isAnimeMovie = mediaType === "anime" && isMovie;

  const creatorLabels = useMemo(() => {
    if (mediaType === "anime") return { field1: "DIRECTOR", field2: "STUDIO" };
    if (mediaType === "manga") return { field1: "WRITER", field2: "PUBLISHED BY" };
    if (mediaType === "game") return { field1: "DEVELOPER", field2: "STUDIO" };
    return { field1: "DIRECTED BY", field2: "PRODUCED BY" };
  }, [mediaType]);

  const castLabel = useMemo(() => {
    return mediaType === "movie" || mediaType === "series" ? "CAST" : "CHARACTERS";
  }, [mediaType]);

  const rewatchLabel = useMemo(() => {
    if (mediaType === "manga") return "REREAD COUNT";
    if (mediaType === "game") return "REPLAY COUNT";
    return "REWATCH COUNT";
  }, [mediaType]);

  // ── EFFECTS ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (activeField === "left-tags") {
      tagRef.current?.focus();
    }
  }, [activeField]);

  const lists = useLists(uid, isOpen);
  const listMediaType = mediaType;

  useInitialListIds(
    uid,
    isOpen,
    currentMode !== "create",
    initialMedia?.id,
    initialMedia?.listIds,
    lists,
    setSelectedListIds,
    setInitialListIds,
  );

  const availableLists = useMemo(
    () => lists.filter((l) => l.types.includes(listMediaType)),
    [lists, listMediaType],
  );

  const relatedTargetIdSet = useMemo(() => new Set(relations.map((r) => r.targetId)), [relations]);

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

  // ── VALIDATION ─────────────────────────────────────────────────────────────

  const userRatingError = useMemo(() => {
    const raw = userRating.trim();
    if (!raw) return null;
    const v = Number(raw);
    if (!Number.isFinite(v) || v < 0.5 || v > 10 || v * 2 !== Math.round(v * 2))
      return "Rating must be 0.5–10 in 0.5 increments.";
    return null;
  }, [userRating]);

  const imdbRatingError = useMemo(() => {
    const raw = imdbRating.trim();
    if (!raw) return null;
    const v = Number(raw);
    if (Number.isNaN(v) || v < 0 || v > 10) return "IMDb rating must be 0–10.";
    return null;
  }, [imdbRating]);

  const releaseYearError = useMemo(() => {
    const raw = releaseYear.trim();
    if (!raw) return null;
    const v = Number(raw);
    const max = new Date().getFullYear() + 1;
    if (!/^\d{4}$/.test(raw) || v < 1888 || v > max) return "Invalid release year.";
    return null;
  }, [releaseYear]);

  useEffect(() => {
    if (status === "unspecified") return;
    if (!getLogEntryStatusOptions(mediaType).includes(status)) {
      setStatus("unspecified");
    }
  }, [mediaType, status]);

  // ── DIRTY TRACKING ─────────────────────────────────────────────────────────

  type FieldSnapshot = {
    title: string;
    mediaType: string;
    status: string;
    userRating: string;
    imdbRating: string;
    releaseYear: string;
    lengthMinutes: string;
    episodeCount: string;
    chapterCount: string;
    totalSeasons: number;
    volumeCount: number;
    playTime: string;
    achievements: string;
    totalAchievements: string;
    platform: string;
    producer: string;
    description: string;
    startDate: string;
    completionDate: string;
    completionUnknown: boolean;
    currentEpisodes: number;
    currentSeasons: number;
    currentChapters: number;
    currentVolumes: number;
    rewatchCount: number;
    tags: string; // JSON.stringify([...tags].sort())
    cast: string; // JSON.stringify([...cast].sort())
    relations: string; // JSON.stringify sorted by targetId
  };

  const snapshotRef = useRef<FieldSnapshot | null>(null);

  const isDirty = useMemo(() => {
    if (currentMode === "create") return false;
    const snap = snapshotRef.current;
    if (!snap) return false;
    // Lists: compare current selection vs initial (tracked by useInitialListIds)
    const listsDirty =
      selectedListIds.size !== initialListIds.size ||
      [...selectedListIds].some((id) => !initialListIds.has(id));
    if (listsDirty) return true;
    const currentRelations = JSON.stringify(
      [...relations]
        .sort((a, b) => a.targetId.localeCompare(b.targetId))
        .map((r) => ({ targetId: r.targetId, type: r.type })),
    );
    const currentTags = JSON.stringify([...tags].sort());
    const currentCast = JSON.stringify([...cast].sort());
    return (
      snap.title !== title ||
      snap.mediaType !== mediaType ||
      snap.status !== status ||
      snap.userRating !== userRating ||
      snap.imdbRating !== imdbRating ||
      snap.releaseYear !== releaseYear ||
      snap.lengthMinutes !== lengthMinutes ||
      snap.episodeCount !== episodeCount ||
      snap.chapterCount !== chapterCount ||
      snap.totalSeasons !== totalSeasons ||
      snap.volumeCount !== volumeCount ||
      snap.playTime !== playTime ||
      snap.achievements !== achievements ||
      snap.totalAchievements !== totalAchievements ||
      snap.platform !== platform ||
      snap.producer !== producer ||
      snap.description !== description ||
      snap.startDate !== startDate ||
      snap.completionDate !== completionDate ||
      snap.completionUnknown !== completionUnknown ||
      snap.currentEpisodes !== currentEpisodes ||
      snap.currentSeasons !== currentSeasons ||
      snap.currentChapters !== currentChapters ||
      snap.currentVolumes !== currentVolumes ||
      snap.rewatchCount !== rewatchCount ||
      snap.tags !== currentTags ||
      snap.cast !== currentCast ||
      snap.relations !== currentRelations
    );
  }, [
    currentMode,
    title,
    mediaType,
    status,
    userRating,
    imdbRating,
    releaseYear,
    lengthMinutes,
    episodeCount,
    chapterCount,
    totalSeasons,
    volumeCount,
    playTime,
    achievements,
    totalAchievements,
    platform,
    producer,
    description,
    startDate,
    completionDate,
    completionUnknown,
    currentEpisodes,
    currentSeasons,
    currentChapters,
    currentVolumes,
    rewatchCount,
    tags,
    cast,
    selectedListIds,
    initialListIds,
    relations,
  ]);

  const initializedRef = useRef<string | number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      initializedRef.current = null;
      setDuplicateToast(null);
      setRefetchError(null);
      return;
    }

    if (normalizedInitial) {
      if (normalizedInitial.id && initializedRef.current === normalizedInitial.id) return;
      initializedRef.current = normalizedInitial.id;

      // Look up the full EntryDoc from cache for fields not present on LoggableMedia.
      const entryDoc =
        currentMode !== "create"
          ? (entries.find((e) => String(e.id) === String(normalizedInitial.id)) ?? null)
          : null;

      // ── Collect new values into locals so state + snapshot are in sync ──────

      const nTitle = normalizedInitial.title;
      const nMediaType = normalizedInitial.inferredType;
      const nIsMovie = !!normalizedInitial.inferredIsMovie;
      const nImage = normalizedInitial.image ?? null;
      const nExternalId = entryDoc?.externalId
        ? String(entryDoc.externalId)
        : "externalId" in normalizedInitial && normalizedInitial.externalId
          ? String(normalizedInitial.externalId)
          : normalizedInitial.id
            ? String(normalizedInitial.id)
            : null;
      const nDescription = normalizedInitial.description ?? "";
      const nReleaseYear = normalizedInitial.releaseYear ?? normalizedInitial.year ?? "";
      const nTags = Array.isArray(normalizedInitial.genresThemes)
        ? normalizedInitial.genresThemes.slice(0, 10)
        : [];
      let nEpisodeCount = normalizedInitial.episodeCount
        ? String(normalizedInitial.episodeCount)
        : "";
      const nChapterCount = normalizedInitial.chapterCount
        ? String(normalizedInitial.chapterCount)
        : "";
      const nLengthMinutes = normalizedInitial.lengthMinutes
        ? String(normalizedInitial.lengthMinutes)
        : "";

      // Default values for display
      if ((nMediaType === "series" || (nMediaType === "anime" && !nIsMovie)) && !nEpisodeCount) {
        nEpisodeCount = "1";
      }

      const uRating =
        typeof normalizedInitial.userRating === "number"
          ? normalizedInitial.userRating
          : currentMode !== "create" && typeof normalizedInitial.rating === "number"
            ? normalizedInitial.rating
            : null;
      const nUserRating =
        uRating != null && uRating >= 1 && uRating <= 10 ? String(Math.round(uRating)) : "";

      const iRating =
        typeof normalizedInitial.imdbRating === "number"
          ? normalizedInitial.imdbRating
          : currentMode !== "create" && typeof normalizedInitial.rating === "number"
            ? normalizedInitial.rating
            : null;
      const nImdbRating = iRating != null && iRating >= 0 && iRating <= 10 ? String(iRating) : "";

      const nStatus = normalizedInitial.status ?? "unspecified";
      const nPlatform = normalizedInitial.platform ?? "";
      const nProducer = normalizedInitial.producer ?? entryDoc?.producer ?? "";
      const nCast = entryDoc?.cast ?? normalizedInitial.cast ?? [];
      const nPlayTime = normalizedInitial.playTime ? String(normalizedInitial.playTime) : "";
      const nAchievements = normalizedInitial.achievements
        ? String(normalizedInitial.achievements)
        : "";
      const nTotalAchievements = normalizedInitial.totalAchievements
        ? String(normalizedInitial.totalAchievements)
        : "";

      let nCompletionDate = "";
      let nCompletionUnknown = false;
      if (isCompletionStatus(normalizedInitial.status ?? "unspecified")) {
        if (normalizedInitial.completionDateUnknown) {
          nCompletionUnknown = true;
        } else if (normalizedInitial.completedAt) {
          nCompletionDate = formatISODate(normalizedInitial.completedAt);
        }
      }

      const nStartDate = entryDoc?.startDate ?? "";
      const nCurrentEpisodes = entryDoc?.currentEpisodes ?? 0;
      const nCurrentSeasons = entryDoc?.currentSeasons ?? 0;
      let nTotalSeasons = entryDoc?.totalSeasons ?? 0;
      const nCurrentChapters = entryDoc?.currentChapters ?? 0;
      const nCurrentVolumes = entryDoc?.currentVolumes ?? 0;
      const nVolumeCount = entryDoc?.volumeCount ?? 0;
      const nRewatchCount = entryDoc?.rewatchCount ?? 0;

      if (
        (nMediaType === "series" || (nMediaType === "anime" && !nIsMovie)) &&
        nTotalSeasons === 0
      ) {
        nTotalSeasons = 1;
      }

      // ── Apply state ─────────────────────────────────────────────────────────

      setTitle(nTitle);
      setMediaType(nMediaType);
      setIsMovie(nIsMovie);
      setImage(nImage);
      setExternalId(nExternalId);
      setDescription(nDescription);
      setReleaseYear(nReleaseYear);
      setDirector(normalizedInitial.director ?? entryDoc?.director ?? "");
      setProducer(nProducer);
      setCast(nCast);
      setTags(nTags);
      setEpisodeCount(nEpisodeCount);
      setChapterCount(nChapterCount);
      setLengthMinutes(nLengthMinutes);
      setUserRating(nUserRating);
      setImdbRating(nImdbRating);
      setStatus(nStatus);
      setPlatform(nPlatform);
      setPlayTime(nPlayTime);
      setAchievements(nAchievements);
      setTotalAchievements(nTotalAchievements);
      setCompletionDate(nCompletionDate);
      setCompletionUnknown(nCompletionUnknown);
      setStartDate(nStartDate);
      setCurrentEpisodes(nCurrentEpisodes);
      setCurrentSeasons(nCurrentSeasons);
      setTotalSeasons(nTotalSeasons);
      setCurrentChapters(nCurrentChapters);
      setCurrentVolumes(nCurrentVolumes);
      setVolumeCount(nVolumeCount);
      setRewatchCount(nRewatchCount);

      // ── Relations ───────────────────────────────────────────────────────────

      let nOriginalRelations: { targetId: string; type: string; createdAtMs: number }[] = [];
      let nRelations: EditableRelation[] = [];
      if (normalizedInitial.relations) {
        const cleaned = normalizedInitial.relations
          .filter((r) => !r.inferred)
          .map((r) => ({
            targetId: String(r.targetId || "").trim(),
            type: String(r.type || "").trim(),
            createdAtMs: Number.isFinite(r.createdAtMs) ? r.createdAtMs : Date.now(),
          }))
          .filter((r) => r.targetId && r.type);
        nOriginalRelations = cleaned;
        nRelations = buildEditableRelations(cleaned, entries);
      }
      setOriginalRelations(nOriginalRelations);
      setRelations(nRelations);
      setRelationQuery("");
      setSelectedRelationDoc(null);

      // ── Snapshot for isDirty tracking ────────────────────────────────────────

      if (currentMode !== "create") {
        snapshotRef.current = {
          title: nTitle,
          mediaType: nMediaType,
          status: nStatus,
          userRating: nUserRating,
          imdbRating: nImdbRating,
          releaseYear: nReleaseYear,
          lengthMinutes: nLengthMinutes,
          episodeCount: nEpisodeCount,
          chapterCount: nChapterCount,
          totalSeasons: nTotalSeasons,
          volumeCount: nVolumeCount,
          playTime: nPlayTime,
          achievements: nAchievements,
          totalAchievements: nTotalAchievements,
          platform: nPlatform,
          producer: nProducer,
          description: nDescription,
          startDate: nStartDate,
          completionDate: nCompletionDate,
          completionUnknown: nCompletionUnknown,
          currentEpisodes: nCurrentEpisodes,
          currentSeasons: nCurrentSeasons,
          currentChapters: nCurrentChapters,
          currentVolumes: nCurrentVolumes,
          rewatchCount: nRewatchCount,
          tags: JSON.stringify([...nTags].sort()),
          cast: JSON.stringify([...nCast].sort()),
          relations: JSON.stringify(
            [...nRelations]
              .sort((a, b) => a.targetId.localeCompare(b.targetId))
              .map((r) => ({ targetId: r.targetId, type: r.type })),
          ),
        };
      }

      setError(null);
      setInfo(null);
    } else if (initializedRef.current !== "new") {
      initializedRef.current = "new";
      snapshotRef.current = null;
      setTitle("");
      setMediaType("movie");
      setIsMovie(false);
      setStatus("unspecified");
      setUserRating("");
      setImdbRating("");
      setReleaseYear("");
      setDirector("");
      setLengthMinutes("");
      setEpisodeCount("");
      setChapterCount("");
      setPlayTime("");
      setAchievements("");
      setTotalAchievements("");
      setPlatform("");
      setTags([]);
      setDescription("");
      setCompletionDate("");
      setCompletionUnknown(false);
      setStartDate("");
      setCurrentEpisodes(0);
      setCurrentSeasons(0);
      setTotalSeasons(0);
      setCurrentChapters(0);
      setRewatchCount(0);
      setImage(null);
      setExternalId(null);
      setSelectedListIds(new Set());
      setInitialListIds(new Set());
      setOriginalRelations([]);
      setRelations([]);
      setRelationQuery("");
      setSelectedRelationDoc(null);
      setError(null);
      setInfo(null);
      setRefetchError(null);
    }
  }, [isOpen, normalizedInitial, entries, currentMode]);

  useEffect(() => {
    if (!isOpen || relations.length === 0) return;
    setRelations((prev) => {
      let changed = false;
      const next = prev.map((r) => {
        const m = entries.find((e) => String(e.id) === r.targetId);
        if (!m || (r.title === m.title && r.image === m.image && r.mediaType === m.mediaType))
          return r;
        changed = true;
        return { ...r, title: m.title, image: m.image, mediaType: m.mediaType };
      });
      return changed ? next : prev;
    });
  }, [entries, isOpen, relations.length]);

  useEffect(() => {
    if (!isOpen) return;
    if (!isCompletionStatus(status)) {
      if (completionDate) setCompletionDate("");
      if (completionUnknown) setCompletionUnknown(false);
      return;
    }
    if (!completionUnknown && !completionDate) setCompletionDate(todayISODate());
  }, [status, isOpen, completionDate, completionUnknown]);

  // ── REFETCH HANDLER ─────────────────────────────────────────────────────────

  const handleRefetch = async () => {
    if (!externalId) {
      setRefetchError("No external ID available for this entry.");
      return;
    }
    setIsRefetching(true);
    setRefetchError(null);
    try {
      const params = new URLSearchParams({
        type: mediaType,
        id: externalId,
        title: title,
      });
      if (releaseYear) params.set("year", releaseYear);

      const response = await fetch(`/api/metadata?${params.toString()}`);
      if (!response.ok) {
        let errMsg = "Metadata fetch failed.";
        try {
          const errPayload = await response.json();
          if (errPayload?.error) errMsg = errPayload.error;
        } catch (_) {}
        throw new Error(errMsg);
      }

      const payload = await response.json();
      const data = payload.data;
      if (!data) throw new Error(payload.error || "No data found.");

      if (data.title) setTitle(data.title);
      if (data.description) setDescription(data.description);
      if (data.image) setImage(data.image);
      if (data.year) setReleaseYear(data.year);
      if (data.rating !== undefined && data.rating !== null) setImdbRating(String(data.rating));
      if (data.lengthMinutes !== undefined && data.lengthMinutes !== null)
        setLengthMinutes(String(data.lengthMinutes));
      if (data.episodeCount !== undefined && data.episodeCount !== null)
        setEpisodeCount(String(data.episodeCount));
      if (data.chapterCount !== undefined && data.chapterCount !== null)
        setChapterCount(String(data.chapterCount));
      if (data.genresThemes) setTags(data.genresThemes.slice(0, 10));
      if (data.cast) setCast(data.cast);
      if (data.director) setDirector(data.director);
      if (data.producer) setProducer(data.producer);

      setInfo("Metadata refetched successfully.");
      setTimeout(() => setInfo(null), 3000);
    } catch (err) {
      console.error(err);
      setRefetchError("Refetch failed. Please try again.");
    } finally {
      setIsRefetching(false);
    }
  };

  // ── SUBMIT HANDLER ──────────────────────────────────────────────────────────

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!uid) {
      setError("Sign in to save entries.");
      return;
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Title is required.");
      return;
    }
    if (trimmedTitle.length > 160) {
      setError("Title is too long.");
      return;
    }
    if (userRatingError || imdbRatingError || releaseYearError) {
      setError(userRatingError ?? imdbRatingError ?? releaseYearError);
      return;
    }

    const userRatingValue = userRating.trim() ? Number(userRating.trim()) : null;
    const imdbRatingValue = imdbRating.trim() ? Number(imdbRating.trim()) : null;
    const releaseYearValue = releaseYear.trim() || null;

    const episodeCountValue =
      ["series", "anime"].includes(mediaType) && episodeCount.trim() ? Number(episodeCount) : null;
    const chapterCountValue =
      mediaType === "manga" && chapterCount.trim() ? Number(chapterCount) : null;
    const lengthMinutesValue =
      (mediaType === "movie" || (mediaType === "anime" && isMovie)) && lengthMinutes.trim()
        ? Number(lengthMinutes)
        : null;
    const playTimeValue = mediaType === "game" && playTime.trim() ? Number(playTime) : null;
    const achievementsValue =
      mediaType === "game" && achievements.trim() ? Number(achievements) : null;
    const totalAchievementsValue =
      mediaType === "game" && totalAchievements.trim() ? Number(totalAchievements) : null;
    const platformValue = mediaType === "game" ? platform.trim() || null : null;

    if (tags.length > 10) {
      setError("Max 10 genres/themes.");
      return;
    }

    let completedAt: Timestamp | null = null;
    let completionDateUnknownValue = false;
    if (isCompletionStatus(status)) {
      completionDateUnknownValue = completionUnknown;
      if (!completionUnknown) {
        const parsed = parseISODate(completionDate.trim());
        if (!parsed) {
          setError("Invalid completion date.");
          return;
        }
        if (parsed.millis > Date.now()) {
          setError("Completion date cannot be in the future.");
          return;
        }
        completedAt = Timestamp.fromDate(parsed.date);
      }
    }

    if (selectedListIds.size > 0) {
      for (const id of selectedListIds) {
        const list = lists.find((l) => l.id === id);
        if (list && !list.types.includes(listMediaType)) {
          setError(`List "${list.name}" doesn't accept ${listMediaType} items.`);
          return;
        }
      }
    }

    if (currentMode === "create") {
      const lower = trimmedTitle.toLowerCase();
      const dupe = entries.some((ent) => {
        if (externalId && String(ent.externalId) === String(externalId)) return true;
        if (ent.mediaType !== mediaType || ent.title.toLowerCase() !== lower) return false;
        const ey = ent.releaseYear ?? ent.year ?? "";
        const ry = releaseYearValue ?? "";
        if (ey && ry && ey !== ry) return false;
        return true;
      });
      if (dupe) {
        setDuplicateToast({
          id: Date.now(),
          message: `"${trimmedTitle}" already in your library.`,
        });
        setError("This item already exists.");
        return;
      }
    }

    setIsSaving(true);
    try {
      const entryId =
        currentMode !== "create" && normalizedInitial?.id ? String(normalizedInitial.id) : null;

      const relationPayload = relations.reduce<
        { targetId: string; type: string; createdAtMs: number }[]
      >((acc, r) => {
        if (!r.targetId || !r.type || acc.some((x) => x.targetId === r.targetId)) return acc;
        acc.push({ targetId: r.targetId, type: r.type, createdAtMs: Date.now() });
        return acc;
      }, []);

      const entryData = {
        title: trimmedTitle,
        mediaType,
        status,
        userRating: userRatingValue,
        imdbRating: imdbRatingValue,
        releaseYear: releaseYearValue,
        year: releaseYearValue,
        lengthMinutes: lengthMinutesValue,
        episodeCount: episodeCountValue,
        chapterCount: chapterCountValue,
        totalSeasons,
        currentVolumes,
        volumeCount,
        playTime: playTimeValue,
        achievements: achievementsValue,
        totalAchievements: totalAchievementsValue,
        platform: platformValue,
        director: director.trim() || null,
        producer: producer.trim() || null,
        cast,
        isMovie,
        genresThemes: tags,
        description: description.trim(),
        image,
        completedAt,
        completionDateUnknown: completionDateUnknownValue,
        updatedAt: serverTimestamp(),
        listIds: Array.from(selectedListIds),
        currentEpisodes,
        currentSeasons,
        currentChapters,
        rewatchCount,
        startDate: startDate.trim() || null,
        relations: relationPayload,
      };

      await saveLogEntry({
        uid,
        isEditing: currentMode !== "create",
        entryId,
        entryData: {
          ...entryData,
          ...(currentMode === "create" && externalId ? { externalId } : {}),
        },
        trimmedTitle,
        listMediaType,
        image,
        releaseYearValue,
        selectedListIds,
        initialListIds,
        originalRelations,
        relationPayload,
      });

      setInfo(currentMode !== "create" ? "Updated." : "Saved.");

      if (currentMode !== "create") {
        setTimeout(onClose, 1000);
      } else {
        // Reset for next entry, then close
        setTitle("");
        setImage(null);
        setExternalId(null);
        setDescription("");
        setReleaseYear("");
        setDirector("");
        setProducer("");
        setCast([]);
        setTags([]);
        setUserRating("");
        setImdbRating("");
        setEpisodeCount("");
        setChapterCount("");
        setLengthMinutes("");
        setCurrentEpisodes(0);
        setCurrentSeasons(0);
        setTotalSeasons(0);
        setCurrentChapters(0);
        setCurrentVolumes(0);
        setVolumeCount(0);
        setRewatchCount(0);
        setCompletionDate("");
        setCompletionUnknown(false);
        setStartDate("");
        setSelectedListIds(new Set());
        setInitialListIds(new Set());
        setRelations([]);
        setOriginalRelations([]);
        setRelationQuery("");
        setSelectedRelationDoc(null);
        setTimeout(onClose, 1000);
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!uid || !normalizedInitial?.id) return;
    setIsDeleting(true);
    try {
      await deleteLogEntry(uid, String(normalizedInitial.id), entries);
      onClose();
    } catch (err) {
      console.error(err);
      setError("Failed to delete.");
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (!isOpen) {
    modalZIndexRef.current = null;
    return null;
  }

  const handleDiscardChanges = () => {
    initializedRef.current = null;
    setCurrentMode("view");
  };

  const isViewMode = currentMode === "view";
  const editableProps = { activeField, setActiveField, readOnly: isViewMode };
  const statusIsComplete = isCompletionStatus(status);
  const statusOptions = getLogEntryStatusOptions(mediaType);
  const getStatusBadgeClass = (s: EntryStatusValue) => {
    switch (s) {
      case "completed":
      case "fully_completed":
        return "border-emerald-500/50 bg-emerald-950/80 text-emerald-400";
      case "watching":
      case "reading":
      case "playing":
        return "border-blue-500/50 bg-blue-950/80 text-blue-400";
      case "rewatching":
      case "rereading":
      case "replaying":
        return "border-sky-500/50 bg-sky-950/80 text-sky-400";
      case "plan_to_watch":
      case "plan_to_read":
      case "plan_to_play":
        return "border-violet-500/50 bg-violet-950/80 text-violet-400";
      case "on_hold":
      case "backlogged":
        return "border-yellow-500/50 bg-yellow-950/80 text-yellow-400";
      case "dropped":
        return "border-red-500/50 bg-red-950/80 text-red-400";
      default:
        return "border-neutral-500/30 bg-neutral-950/80 text-neutral-400";
    }
  };
  if (isOpen && modalZIndexRef.current === null) {
    modalZIndexRef.current = acquireModalZIndex();
  }

  // ── RENDER ──────────────────────────────────────────────────────────────────

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-6 bg-black/75 backdrop-blur-sm"
      style={modalZIndexRef.current ? { zIndex: modalZIndexRef.current } : undefined}
    >
      <div
        className="relative w-full max-w-[1200px] bg-[#111] rounded-2xl overflow-hidden flex flex-col shadow-2xl border border-white/5"
        style={{ height: "min(720px, 90vh)" }}
      >
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 text-white/20 hover:text-white/60 transition-colors z-40"
        >
          <X className="w-5 h-5" />
        </button>

        <form onSubmit={onSubmit} className="flex flex-col h-full overflow-hidden">
          <div className="flex-1 flex overflow-hidden min-h-0">
            {isViewMode ? (
              <div className="flex-1 overflow-y-auto p-8 bg-[#111] flex flex-col">
                <div className="flex flex-col gap-5 mb-8">
                  <div className="flex flex-col items-start gap-5">
                    <span
                      className={cn(
                        "inline-flex items-center gap-2 rounded-full border backdrop-blur-md px-3 py-1 text-[10px] font-bold uppercase tracking-wider shrink-0",
                        getStatusBadgeClass(status),
                      )}
                    >
                      {entryStatusLabels[status] ?? status}
                    </span>
                    {userRating && (
                      <div className="p-3 bg-neutral-500/10 rounded-xl inline-flex flex-col w-max">
                        <div className="px-1">
                          <StarRating
                            value={userRating}
                            onChange={() => {}}
                            readOnly
                            showValue={false}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-5">
                    <div className="relative h-64 aspect-[2/3] rounded-lg overflow-hidden bg-[#1a1a1a] shrink-0 shadow-2xl border border-white/5">
                      {image ? (
                        <Image src={image} alt={title} fill className="object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Search className="w-6 h-6 text-white/10" />
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col justify-end min-w-0 flex-1 pb-2">
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex flex-col min-w-0 items-start gap-3">
                          <span className="px-3 py-1 rounded-full border border-white/10 text-[10px] font-mono text-white/40 uppercase tracking-[0.15em] shrink-0">
                            {entryMediaTypeLabels[mediaType] ?? mediaType}
                          </span>
                          <div
                            className={cn(
                              "font-black leading-tight uppercase tracking-tight text-white pr-2",
                              titleFontSize,
                            )}
                          >
                            {title}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-white/20 mb-0.5">
                            {creatorLabels.field1}
                          </span>
                          <span className="text-[13px] font-medium text-white/70">
                            {director || "—"}
                          </span>
                        </div>

                        {creatorLabels.field2 && (
                          <div className="flex flex-col">
                            <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-white/20 mb-0.5">
                              {creatorLabels.field2}
                            </span>
                            <span className="text-[13px] font-medium text-white/70">
                              {producer || "—"}
                            </span>
                          </div>
                        )}

                        <div className="flex flex-col col-span-2">
                          <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-white/20 mb-0.5">
                            {castLabel}
                          </span>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {cast.length > 0 ? (
                              cast.map((p) => (
                                <span
                                  key={p}
                                  className="text-[11px] text-white/50 bg-white/5 px-2 py-0.5 rounded cursor-default"
                                >
                                  {p}
                                </span>
                              ))
                            ) : (
                              <span className="text-[13px] font-medium text-white/70">—</span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col">
                          <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-white/20 mb-0.5">
                            RELEASED
                          </span>
                          <span className="text-[13px] font-medium text-white/70">
                            {releaseYear || "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-12 mb-8 p-6 bg-[#1a1a1a] rounded-xl border border-white/5 flex-wrap">
                  {(mediaType === "movie" || isAnimeMovie) && (
                    <StatColumn
                      label="LENGTH"
                      value={lengthMinutes ? `${lengthMinutes} min` : "—"}
                    />
                  )}

                  {(mediaType === "series" || (mediaType === "anime" && !isAnimeMovie)) && (
                    <>
                      <StatColumn
                        label="EPISODES"
                        value={`${currentEpisodes} / ${episodeCount || "?"}`}
                      />
                      <StatColumn
                        label="SEASONS"
                        value={`${currentSeasons} / ${totalSeasons || "?"}`}
                      />
                    </>
                  )}

                  {mediaType === "manga" && (
                    <>
                      <StatColumn
                        label="CHAPTERS"
                        value={`${currentChapters} / ${chapterCount || "?"}`}
                      />
                      <StatColumn
                        label="VOLUMES"
                        value={`${currentVolumes} / ${volumeCount || "?"}`}
                      />
                    </>
                  )}

                  {rewatchCount > 0 && (
                    <StatColumn
                      label={rewatchLabel}
                      value={String(rewatchCount).padStart(2, "0")}
                    />
                  )}

                  <StatColumn label="IMDB RATING" value={imdbRating ? `${imdbRating}` : "—"} />
                </div>

                {tags.length > 0 && (
                  <div className="mb-8">
                    <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/20 mb-3">
                      GENRE / THEME
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2.5 py-1 rounded-md border border-white/[0.05] bg-white/[0.03] text-[10px] text-white/50 font-mono uppercase tracking-[0.05em]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedListIds.size > 0 && (
                  <div className="mb-8">
                    <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/20 mb-3">
                      LISTS
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {availableLists
                        .filter((l) => selectedListIds.has(l.id))
                        .map((list) => (
                          <span
                            key={list.id}
                            className="px-4 py-1.5 rounded-full text-[11px] font-mono uppercase tracking-wider bg-white/5 text-white/60 border border-white/10"
                          >
                            {list.name}
                          </span>
                        ))}
                    </div>
                  </div>
                )}

                {(startDate || statusIsComplete) && (
                  <div className="mb-8">
                    <div className="flex gap-12">
                      {startDate && (
                        <div>
                          <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#555] mb-1">
                            STARTED
                          </div>
                          <div className="text-[13px] text-white/70 font-medium">{startDate}</div>
                        </div>
                      )}
                      {statusIsComplete && (
                        <div>
                          <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#555] mb-1">
                            COMPLETED
                          </div>
                          <div className="text-[13px] text-white/70 font-medium">
                            {completionUnknown ? "Unknown" : completionDate || "—"}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {relations.length > 0 && (
                  <div className="mb-8">
                    <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/20 mb-3">
                      RELATIONS
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {relations.map((rel) => (
                        <div
                          key={rel.targetId}
                          className="flex items-center gap-3 bg-[#1a1a1a] border border-white/5 p-2 pr-4 rounded-lg min-w-[200px]"
                        >
                          <div className="w-10 h-14 relative rounded overflow-hidden bg-[#222] shrink-0">
                            {rel.image && (
                              <Image src={rel.image} alt="" fill className="object-cover" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] text-white font-medium truncate">
                              {rel.title}
                            </div>
                            <div className="text-[10px] text-[#555] font-mono uppercase mt-0.5">
                              {rel.type}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-2 pb-8">
                  <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/20">
                    DESCRIPTION
                  </div>
                  <div className="text-[13px] text-white/40 leading-relaxed italic pr-4 whitespace-pre-wrap">
                    {description || "No description provided."}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* LEFT PANEL */}
                <div className="w-[540px] shrink-0 border-r border-white/5 overflow-y-auto p-8 flex flex-col bg-[#111]">
                  {/* 1. TYPE BADGE & REFETCH */}
                  <div className="mb-6 flex justify-between items-center">
                    <span className="px-3 py-1 rounded-full border border-white/10 text-[10px] font-mono text-white/40 uppercase tracking-[0.15em]">
                      {entryMediaTypeLabels[mediaType] ?? mediaType}
                    </span>

                    {currentMode !== "create" && externalId && (
                      <div className="flex items-center gap-3">
                        {refetchError && (
                          <span className="text-[10px] font-mono text-red-400">{refetchError}</span>
                        )}
                        <button
                          type="button"
                          onClick={handleRefetch}
                          disabled={isRefetching}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors border border-white/10 text-[10px] font-mono text-white/60 hover:text-white disabled:opacity-50"
                        >
                          <RefreshCw className={cn("w-3 h-3", isRefetching && "animate-spin")} />
                          {isRefetching ? "REFETCHING..." : "REFETCH"}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 2. IMAGE + MAIN INFO (TITLE, DIRECTOR, YEAR) */}
                  <div className="flex gap-6 mb-8">
                    <div className="relative h-64 aspect-[2/3] rounded-lg overflow-hidden bg-[#1a1a1a] shrink-0 shadow-2xl border border-white/5">
                      {image ? (
                        <Image src={image} alt={title} fill className="object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Search className="w-6 h-6 text-white/10" />
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col justify-end min-w-0 flex-1">
                      <InlineEditable
                        value={title}
                        onCommit={setTitle}
                        fieldId="left-title"
                        {...editableProps}
                        noTruncate
                        className={cn(
                          "font-black leading-tight uppercase tracking-tight text-white mb-3 pr-2",
                          titleFontSize,
                        )}
                      />

                      <div className="flex flex-col gap-1.5">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-white/20 mb-0.5">
                            {creatorLabels.field1}
                          </span>
                          <InlineEditable
                            value={director || "—"}
                            onCommit={setDirector}
                            fieldId="left-director"
                            {...editableProps}
                            className="text-[13px] font-medium text-white/70"
                          />
                        </div>

                        {creatorLabels.field2 && (
                          <div className="flex flex-col">
                            <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-white/20 mb-0.5">
                              {creatorLabels.field2}
                            </span>
                            <InlineEditable
                              value={producer || "—"}
                              onCommit={setProducer}
                              fieldId="left-producer"
                              {...editableProps}
                              className="text-[13px] font-medium text-white/70"
                            />
                          </div>
                        )}
                        <div className="flex flex-col">
                          <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-white/20 mb-0.5">
                            {castLabel}
                          </span>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {cast.map((p) => (
                              <span
                                key={p}
                                className="text-[11px] text-white/50 bg-white/5 px-2 py-0.5 rounded cursor-default"
                              >
                                {p}
                              </span>
                            ))}
                            <button
                              type="button"
                              onClick={() => setActiveField("left-cast")}
                              className="text-[10px] text-white/20 hover:text-white/40 font-mono transition-colors"
                            >
                              {cast.length > 0 ? "+ EDIT" : "+ ADD"}
                            </button>
                          </div>
                          {activeField === "left-cast" && (
                            <div className="mt-2">
                              <input
                                ref={castRef}
                                placeholder="Comma-separated names..."
                                defaultValue={cast.join(", ")}
                                onBlur={(e) => {
                                  setCast(
                                    e.target.value
                                      .split(",")
                                      .map((v) => v.trim())
                                      .filter(Boolean)
                                      .slice(0, 20),
                                  );
                                  setActiveField(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                  if (e.key === "Escape") setActiveField(null);
                                }}
                                className="w-full bg-[#1a1a1a] border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-white/20"
                              />
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-white/20 mb-0.5">
                            Released
                          </span>
                          <InlineEditable
                            value={releaseYear}
                            onCommit={setReleaseYear}
                            type="number"
                            fieldId="left-year"
                            {...editableProps}
                            className="text-[13px] font-medium text-white/70"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3. STATS (EPISODES, SEASONS, RATING) */}
                  <div className="grid grid-cols-3 gap-4 mb-8">
                    {(mediaType === "movie" || isAnimeMovie) && (
                      <InlineEditable
                        value={lengthMinutes}
                        onCommit={setLengthMinutes}
                        type="number"
                        fieldId="left-length"
                        {...editableProps}
                      >
                        <StatColumn label="LENGTH (min)" value={lengthMinutes || "—"} />
                      </InlineEditable>
                    )}

                    {(mediaType === "series" || (mediaType === "anime" && !isAnimeMovie)) && (
                      <>
                        <InlineEditable
                          value={episodeCount}
                          onCommit={setEpisodeCount}
                          type="number"
                          fieldId="left-episodes"
                          {...editableProps}
                        >
                          <StatColumn label="EPISODES" value={episodeCount || "—"} />
                        </InlineEditable>

                        <InlineEditable
                          value={String(totalSeasons)}
                          onCommit={(v) => setTotalSeasons(Number(v) || 0)}
                          type="number"
                          fieldId="left-seasons"
                          {...editableProps}
                        >
                          <StatColumn
                            label="SEASONS"
                            value={totalSeasons ? String(totalSeasons).padStart(2, "0") : "0"}
                          />
                        </InlineEditable>
                      </>
                    )}

                    {mediaType === "manga" && (
                      <>
                        <InlineEditable
                          value={chapterCount}
                          onCommit={setChapterCount}
                          type="number"
                          fieldId="left-chapters"
                          {...editableProps}
                        >
                          <StatColumn label="CHAPTERS" value={chapterCount || "—"} />
                        </InlineEditable>

                        <InlineEditable
                          value={String(volumeCount)}
                          onCommit={(v) => setVolumeCount(Number(v) || 0)}
                          type="number"
                          fieldId="left-volumes"
                          {...editableProps}
                        >
                          <StatColumn
                            label="VOLUMES"
                            value={volumeCount ? String(volumeCount).padStart(2, "0") : "0"}
                          />
                        </InlineEditable>
                      </>
                    )}

                    {mediaType !== "game" && (
                      <InlineEditable
                        value={imdbRating}
                        onCommit={setImdbRating}
                        type="number"
                        fieldId="left-rating"
                        {...editableProps}
                      >
                        <StatColumn label="RATING" value={imdbRating ? `★ ${imdbRating}` : "—"} />
                      </InlineEditable>
                    )}

                    {mediaType === "game" && (
                      <div className="col-start-3">
                        <InlineEditable
                          value={imdbRating}
                          onCommit={setImdbRating}
                          type="number"
                          fieldId="left-rating"
                          {...editableProps}
                        >
                          <StatColumn label="RATING" value={imdbRating ? `★ ${imdbRating}` : "—"} />
                        </InlineEditable>
                      </div>
                    )}
                  </div>

                  {/* 4. GENRE / THEMES */}
                  <div className="mb-8">
                    <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/20 mb-3">
                      GENRE / THEMES
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2.5 py-1 rounded-md border border-white/[0.05] bg-white/[0.03] text-[10px] text-white/50 font-mono uppercase tracking-[0.05em]"
                        >
                          {tag}
                        </span>
                      ))}
                      <button
                        type="button"
                        onClick={() => setActiveField("left-tags")}
                        className="px-2.5 py-1 rounded-md border border-dashed border-white/10 text-[10px] font-mono text-white/20 hover:text-white/40 hover:border-white/20 transition-all"
                      >
                        + EDIT
                      </button>
                    </div>
                    {activeField === "left-tags" && (
                      <div className="mt-3">
                        <input
                          ref={tagRef}
                          placeholder="Comma-separated tags..."
                          defaultValue={tags.join(", ")}
                          onBlur={(e) => {
                            setTags(
                              e.target.value
                                .split(",")
                                .map((t) => t.trim())
                                .filter(Boolean)
                                .slice(0, 10),
                            );
                            setActiveField(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                            if (e.key === "Escape") setActiveField(null);
                          }}
                          className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-white/20"
                        />
                      </div>
                    )}
                  </div>

                  {/* 5. DESCRIPTION */}
                  <div className="flex flex-col gap-2">
                    <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/20">
                      DESCRIPTION
                    </div>
                    <InlineEditable
                      value={description}
                      onCommit={setDescription}
                      fieldId="left-desc"
                      multiline
                      {...editableProps}
                      className="text-[13px] text-white/40 leading-relaxed italic pr-4"
                    />
                  </div>
                </div>

                {/* RIGHT PANEL */}
                <div className="flex-1 overflow-y-auto p-7 bg-[#111]">
                  {/* STATUS */}
                  <div className="mb-6">
                    <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-[#555] mb-2">
                      CURRENT STATUS
                    </div>
                    <div className="relative">
                      <select
                        value={status}
                        onChange={(e) => {
                          const next = e.target.value as EntryStatusValue;
                          setStatus(next);
                          if (isCompletionStatus(next)) {
                            if (!completionDate && !completionUnknown) {
                              setCompletionDate(todayISODate());
                            }
                            // Auto-fill progress
                            if (episodeCount) setCurrentEpisodes(Number(episodeCount));
                            if (totalSeasons) setCurrentSeasons(totalSeasons);
                            if (chapterCount) setCurrentChapters(Number(chapterCount));
                            if (volumeCount) setCurrentVolumes(volumeCount);
                          }
                        }}
                        style={{ colorScheme: "dark" }}
                        className="w-full bg-[#1a1a1a] border border-white/10 rounded-full py-2.5 px-5 pr-10 appearance-none text-[13px] text-white focus:outline-none focus:border-white/20 transition-all"
                      >
                        <option value="unspecified">Select status</option>
                        {statusOptions.map((s) => (
                          <option key={s} value={s}>
                            {entryStatusLabels[s]}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555] pointer-events-none" />
                    </div>
                  </div>

                  {/* SCORE */}
                  <div className="mb-6 p-4 bg-[#1a1a1a] rounded-xl border border-white/[0.05]">
                    <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-[#555] mb-3">
                      SCORE
                    </div>
                    <StarRating value={userRating} onChange={setUserRating} readOnly={false} />
                  </div>

                  {/* PROGRESS STEPPERS */}
                  {mediaType !== "movie" && !isAnimeMovie && mediaType !== "game" && (
                    <div className="grid grid-cols-2 gap-6 mb-6">
                      {(mediaType === "series" || (mediaType === "anime" && !isAnimeMovie)) && (
                        <>
                          <Stepper
                            label="EPISODE"
                            value={currentEpisodes}
                            onValueChange={setCurrentEpisodes}
                            readOnly={false}
                            max={episodeCount ? Number(episodeCount) : undefined}
                          />
                          <Stepper
                            label="SEASON"
                            value={currentSeasons}
                            onValueChange={setCurrentSeasons}
                            readOnly={false}
                            max={totalSeasons || undefined}
                          />
                        </>
                      )}
                      {mediaType === "manga" && (
                        <>
                          <Stepper
                            label="CHAPTER"
                            value={currentChapters}
                            onValueChange={setCurrentChapters}
                            readOnly={false}
                            max={chapterCount ? Number(chapterCount) : undefined}
                          />
                          <Stepper
                            label="VOLUME"
                            value={currentVolumes}
                            onValueChange={setCurrentVolumes}
                            readOnly={false}
                            max={volumeCount || undefined}
                          />
                        </>
                      )}
                    </div>
                  )}

                  {/* Rewatch / reread / replay count */}
                  <div className="mb-6">
                    <Stepper
                      label={rewatchLabel}
                      value={rewatchCount}
                      onValueChange={setRewatchCount}
                      readOnly={false}
                    />
                  </div>

                  {/* LISTS */}
                  <SectionHeader title="Lists" />
                  <div className="flex flex-wrap gap-2 mb-2">
                    {availableLists.map((list) => (
                      <button
                        key={list.id}
                        type="button"
                        onClick={() => {
                          const next = new Set(selectedListIds);
                          next.has(list.id) ? next.delete(list.id) : next.add(list.id);
                          setSelectedListIds(next);
                        }}
                        className={cn(
                          "px-4 py-1.5 rounded-full text-[11px] font-mono uppercase tracking-wider transition-all border",
                          selectedListIds.has(list.id)
                            ? "bg-white text-black border-white font-bold"
                            : "bg-transparent text-[#aaa] border-white/10 hover:border-white/20 hover:text-white",
                        )}
                      >
                        {list.name}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setIsNewListOpen(true)}
                      className="px-4 py-1.5 rounded-full text-[11px] font-mono uppercase tracking-wider border border-dashed border-white/10 text-[#555] hover:text-[#888] hover:border-white/20 transition-all"
                    >
                      + NEW LIST
                    </button>
                  </div>

                  {/* DATES */}
                  <SectionHeader title="Dates" />
                  <div className="grid grid-cols-2 gap-5 mb-2">
                    <div>
                      <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#555] mb-2">
                        STARTED
                      </div>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => {
                          setStartDate(e.target.value);
                        }}
                        style={{ colorScheme: "dark" }}
                        className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg py-3 px-4 text-[13px] text-white focus:outline-none focus:border-white/20 transition-all"
                      />
                      <div className="flex gap-4 mt-2">
                        <button
                          type="button"
                          onClick={() => setStartDate(todayISODate())}
                          className="text-[10px] font-mono uppercase tracking-[0.1em] text-[#555] hover:text-white transition-colors"
                        >
                          SET TODAY
                        </button>
                        <button
                          type="button"
                          onClick={() => setStartDate("")}
                          className={cn(
                            "text-[10px] font-mono uppercase tracking-[0.1em] transition-colors",
                            !startDate ? "text-white" : "text-[#555] hover:text-white",
                          )}
                        >
                          UNKNOWN
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#555] mb-2">
                        COMPLETED
                      </div>
                      <input
                        type="date"
                        value={completionDate}
                        onChange={(e) => {
                          setCompletionDate(e.target.value);
                          if (e.target.value) setCompletionUnknown(false);
                        }}
                        style={{ colorScheme: "dark" }}
                        className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg py-3 px-4 text-[13px] text-white focus:outline-none focus:border-white/20 transition-all disabled:opacity-40"
                        disabled={!statusIsComplete}
                      />
                      {statusIsComplete && (
                        <div className="flex gap-4 mt-2">
                          <button
                            type="button"
                            onClick={() => setCompletionDate(todayISODate())}
                            className="text-[10px] font-mono uppercase tracking-[0.1em] text-[#555] hover:text-white transition-colors"
                          >
                            SET TODAY
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const next = !completionUnknown;
                              setCompletionUnknown(next);
                              if (next) setCompletionDate("");
                            }}
                            className={cn(
                              "text-[10px] font-mono uppercase tracking-[0.1em] transition-colors",
                              completionUnknown ? "text-white" : "text-[#555] hover:text-white",
                            )}
                          >
                            UNKNOWN
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* RELATIONS */}
                  <SectionHeader title="Relations" />

                  <div className="relative mb-3">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555]" />
                    <input
                      value={relationQuery}
                      onChange={(e) => {
                        setRelationQuery(e.target.value);
                        setSelectedRelationDoc(null);
                      }}
                      placeholder="Search for related media…"
                      className="w-full bg-[#1a1a1a] border border-white/5 rounded-lg py-3 pl-11 pr-4 text-[13px] text-white placeholder-[#444] focus:outline-none focus:border-white/10"
                    />
                    {relationQuery && !selectedRelationDoc && (
                      <div className="absolute top-full left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-[#1a1a1a] border border-white/10 rounded-lg shadow-2xl z-20">
                        {entries
                          .filter(
                            (ent) =>
                              ent.title.toLowerCase().includes(relationQuery.toLowerCase()) &&
                              String(ent.id) !== String(normalizedInitial?.id ?? "") &&
                              !relatedTargetIdSet.has(String(ent.id)),
                          )
                          .map((ent) => (
                            <button
                              key={ent.id}
                              type="button"
                              onClick={() => {
                                setSelectedRelationDoc(ent);
                                setRelationQuery(ent.title);
                              }}
                              className="w-full text-left px-4 py-2.5 text-[12px] text-[#888] hover:bg-white/[0.03] hover:text-white transition-colors"
                            >
                              {ent.title}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>

                  {relations.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {relations.map((rel, idx) => (
                        <div
                          key={rel.targetId}
                          className="flex items-center gap-3 bg-[#1a1a1a] border border-white/5 p-2 pr-3 rounded-lg"
                        >
                          <div className="w-8 h-12 relative rounded overflow-hidden bg-[#222] shrink-0">
                            {rel.image && (
                              <Image src={rel.image} alt="" fill className="object-cover" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[12px] text-white font-medium truncate max-w-[100px]">
                              {rel.title}
                            </div>
                            <div className="text-[10px] text-[#555] font-mono uppercase">
                              {rel.type}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setRelations((prev) => prev.filter((_, i) => i !== idx))}
                            className="text-[#444] hover:text-white transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedRelationDoc && (
                    <div className="p-4 bg-[#1a1a1a] rounded-xl border border-white/10 space-y-4 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-14 relative rounded overflow-hidden bg-[#222] shrink-0">
                          {selectedRelationDoc.image && (
                            <Image
                              src={selectedRelationDoc.image}
                              alt=""
                              fill
                              className="object-cover"
                            />
                          )}
                        </div>
                        <div className="text-[13px] font-bold text-white">
                          {selectedRelationDoc.title}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-mono text-[#555] uppercase tracking-widest mb-2">
                          RELATION TYPE
                        </div>
                        <CustomDropdown
                          value={selectedRelationType}
                          onChange={(v) => setSelectedRelationType(v as RelationType)}
                          options={RELATION_OPTIONS}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const targetId = String(selectedRelationDoc.id);
                          if (relations.some((r) => r.targetId === targetId)) {
                            setError("Already related. Remove it first to change type.");
                            return;
                          }
                          setRelations((prev) => [
                            ...prev,
                            {
                              targetId,
                              type: selectedRelationType,
                              title: selectedRelationDoc.title,
                              image: selectedRelationDoc.image,
                              mediaType: selectedRelationDoc.mediaType,
                            },
                          ]);
                          setRelationQuery("");
                          setSelectedRelationDoc(null);
                        }}
                        className="w-full py-2.5 bg-white text-black text-[11px] font-bold rounded-lg hover:bg-neutral-200 transition-colors uppercase tracking-widest"
                      >
                        CONFIRM ATTACHMENT
                      </button>
                    </div>
                  )}

                  {error && <div className="mt-4 text-[12px] font-mono text-red-400">{error}</div>}
                  {info && (
                    <div className="mt-4 text-[12px] font-mono text-emerald-400">{info}</div>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="h-16 shrink-0 bg-[#111] border-t border-white/[0.06] px-6 flex items-center justify-between z-1000">
            {showDeleteConfirm ? (
              <>
                <div className="text-[11px] font-mono text-red-500/80 uppercase tracking-widest animate-pulse font-bold">
                  Confirm Deletion?
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="text-[11px] font-mono uppercase tracking-[0.12em] text-[#555] hover:text-[#888] transition-colors"
                  >
                    CANCEL
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={handleDelete}
                    className="bg-red-500 text-white px-7 py-2.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-[0.14em] hover:bg-red-600 transition-colors disabled:opacity-50"
                  >
                    {isDeleting ? "DELETING..." : "CONFIRM DELETE"}
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Left */}
                <div className="w-1/3 flex justify-start">
                  {currentMode === "create" && (
                    <button
                      type="button"
                      onClick={handleClose}
                      className="text-[11px] font-mono uppercase tracking-[0.12em] text-[#555] hover:text-[#888] transition-colors"
                    >
                      DISCARD DRAFT
                    </button>
                  )}
                  {currentMode === "view" && (
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="text-[11px] font-mono uppercase tracking-[0.12em] text-red-500/30 hover:text-red-500/60 transition-colors"
                    >
                      DELETE ENTRY
                    </button>
                  )}
                  {currentMode === "edit" && (
                    <button
                      type="button"
                      onClick={handleDiscardChanges}
                      className="text-[11px] font-mono uppercase tracking-[0.12em] text-[#555] hover:text-[#888] transition-colors"
                    >
                      DISCARD CHANGES
                    </button>
                  )}
                </div>

                {/* Center */}
                <div className="w-1/3 flex justify-center">
                  <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/10 select-none">
                    PRESS ESC TO EXIT
                  </div>
                </div>

                {/* Right */}
                <div className="w-1/3 flex justify-end">
                  {currentMode === "create" && (
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="bg-white text-[#111] px-7 py-2.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-[0.14em] hover:bg-neutral-200 transition-all disabled:opacity-50"
                    >
                      {isSaving ? "SAVING..." : "SAVE ENTRY"}
                    </button>
                  )}
                  {currentMode === "view" && (
                    <button
                      type="button"
                      onClick={() => setCurrentMode("edit")}
                      className="bg-white cursor-pointer text-black px-7 py-2.5 rounded-full text-xs font-mono font-bold uppercase tracking-[0.14em] hover:bg-neutral-200 transition-all"
                    >
                      EDIT
                    </button>
                  )}
                  {currentMode === "edit" && (
                    <button
                      type="submit"
                      disabled={isSaving || !isDirty}
                      className={cn(
                        "px-7 py-2.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-[0.14em] transition-all",
                        isDirty
                          ? "bg-white text-[#111] hover:bg-neutral-200"
                          : "bg-white/5 text-white/40 cursor-not-allowed",
                      )}
                    >
                      {isSaving ? "SAVING..." : "SAVE CHANGES"}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </form>
      </div>

      <NewListModal
        isOpen={isNewListOpen}
        onClose={() => setIsNewListOpen(false)}
        defaultType={mediaType}
        onCreated={(list) => {
          setSelectedListIds((prev) => new Set([...prev, list.id]));
        }}
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
