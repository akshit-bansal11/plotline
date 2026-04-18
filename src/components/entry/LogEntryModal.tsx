"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  CheckCircle,
  ChevronDown,
  Disc,
  Gamepad2,
  HardDrive,
  Hexagon,
  Laptop,
  Loader2,
  Monitor,
  Plus,
  Search,
  Smartphone,
  Tablet,
  Terminal,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { NewListModal } from "@/components/lists/NewListModal";
import { InfographicToast } from "@/components/overlay/InfographicToast";
import { Modal } from "@/components/overlay/Modal";
import { DescriptionTextarea } from "@/components/ui/DescriptionTextarea";
import { ExpandableText } from "@/components/ui/ExpandableText";
import { ImageWithSkeleton } from "@/components/ui/ImageWithSkeleton";
import { useAuth } from "@/context/AuthContext";
import { type EntryDoc, useData } from "@/context/DataContext";
import { db } from "@/lib/firebase";
import {
  RELATION_OPTIONS,
  type RelationType,
  updateBidirectionalRelations,
} from "@/services/relations";
import { cn, entryMediaTypeLabels, entryStatusLabels } from "@/utils";
import { sanitizeImportedDescription } from "@/utils/validation";

export type EntryMediaType = "movie" | "series" | "anime" | "manga" | "game";
export type EntryStatus =
  | "watching"
  | "completed"
  | "plan_to_watch"
  | "on_hold"
  | "dropped"
  | "unspecified"
  | "main_story_completed"
  | "fully_completed"
  | "backlogged"
  | "bored"
  | "own"
  | "wishlist"
  | "not_committed"
  | "committed";

export const PLATFORM_OPTIONS = [
  { id: "Steam", label: "Steam", icon: Monitor },
  { id: "Epic Games", label: "Epic Games", icon: Hexagon },
  { id: "PC Local", label: "PC Local", icon: HardDrive },
  { id: "Physical Disc", label: "Physical Disc", icon: Disc },
  { id: "PS5", label: "PS5", icon: Gamepad2 },
  { id: "PS4", label: "PS4", icon: Gamepad2 },
  { id: "PS3", label: "PS3", icon: Gamepad2 },
  { id: "PS2", label: "PS2", icon: Gamepad2 },
  { id: "PS", label: "PS", icon: Gamepad2 },
  { id: "PSP", label: "PSP", icon: Gamepad2 },
  { id: "PS5 Pro", label: "PS5 Pro", icon: Gamepad2 },
  { id: "Xbox Series X", label: "Xbox Series X", icon: Gamepad2 },
  { id: "Xbox Series S", label: "Xbox Series S", icon: Gamepad2 },
  { id: "Xbox One X", label: "Xbox One X", icon: Gamepad2 },
  { id: "Xbox One S", label: "Xbox One S", icon: Gamepad2 },
  { id: "Xbox One", label: "Xbox One", icon: Gamepad2 },
  { id: "Xbox 360", label: "Xbox 360", icon: Gamepad2 },
  { id: "Xbox", label: "Xbox", icon: Gamepad2 },
  { id: "Switch", label: "Switch", icon: Tablet },
  { id: "Steam Deck", label: "Steam Deck", icon: Tablet },
  { id: "GOG", label: "GOG", icon: Monitor },
  { id: "Android", label: "Android", icon: Smartphone },
  { id: "iOS", label: "iOS", icon: Smartphone },
  { id: "MacOS", label: "MacOS", icon: Laptop },
  { id: "Linux", label: "Linux", icon: Terminal },
];

export type LoggableMedia = {
  id: string | number;
  title: string;
  image: string | null;
  year?: string;
  releaseYear?: string;
  type: EntryMediaType | "anime_movie"; // Keep anime_movie for legacy handling if needed, or normalize early
  description?: string;
  userRating?: number | null;
  imdbRating?: number | null;
  rating?: number | null;
  lengthMinutes?: number | null;
  episodeCount?: number | null;
  chapterCount?: number | null;
  // Game specific
  playTime?: number | null;
  achievements?: number | null;
  totalAchievements?: number | null;
  platform?: string | null;

  isMovie?: boolean;
  listIds?: string[]; // IDs of lists this item belongs to

  genresThemes?: string[];
  status?: EntryStatus;
  completedAt?: number | null;
  completionDateUnknown?: boolean;
  relations?: {
    targetId: string;
    type: string;
    createdAtMs: number;
    inferred?: boolean;
  }[];
};

type ListMediaType = "movie" | "series" | "anime" | "manga" | "game";

type SearchResult = {
  id: string;
  title: string;
  image: string | null;
  year?: string;
  type: EntryMediaType;
  overview?: string;
  rating?: number | null;
};

interface SearchResponse {
  results: SearchResult[];
  errors?: string[];
  cached?: boolean;
}

type EditableRelation = {
  targetId: string;
  type: string;
  title: string;
  image: string | null;
  mediaType: string;
};

const buildEditableRelations = (
  rawRelations: Array<{ targetId: string; type: string }>,
  entries: EntryDoc[],
): EditableRelation[] => {
  const next: EditableRelation[] = [];
  const seenTargets = new Set<string>();

  for (const relation of rawRelations) {
    const targetId = String(relation.targetId || "").trim();
    const type = String(relation.type || "").trim();
    if (!targetId || !type) continue;
    if (seenTargets.has(targetId)) continue;

    seenTargets.add(targetId);
    const match = entries.find((entry) => String(entry.id) === targetId);
    next.push({
      targetId,
      type,
      title: match ? match.title : "Unknown Entry",
      image: match ? match.image : null,
      mediaType: match ? match.mediaType : "movie",
    });
  }

  return next;
};

const statusLabels: Record<EntryStatus, string> = entryStatusLabels;
const mediaTypeLabels: Record<EntryMediaType, string> = entryMediaTypeLabels;

const STANDARD_STATUS_OPTIONS: EntryStatus[] = [
  "watching",
  "completed",
  "plan_to_watch",
  "on_hold",
  "dropped",
];
const GAME_STATUS_OPTIONS: EntryStatus[] = [
  "main_story_completed",
  "fully_completed",
  "backlogged",
  "bored",
  "own",
  "wishlist",
  "not_committed",
  "committed",
  "dropped",
];

const todayISODate = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const formatISODate = (millis: number): string => {
  const date = new Date(millis);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const parseISODate = (value: string): { date: Date; millis: number } | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day)
    return null;
  return { date, millis: date.getTime() };
};

export function LogEntryModal({
  isOpen,
  onClose,
  initialMedia,
  isEditing = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialMedia?: LoggableMedia | null;
  onCreateList?: () => void;
  isEditing?: boolean;
}) {
  const { user } = useAuth();
  const { entries } = useData();
  const [activeTab, setActiveTab] = useState<"manual" | "search">("manual");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchType, setSearchType] = useState<EntryMediaType>("movie");
  const abortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<
    Map<string, { timestamp: number; results: SearchResult[]; errors: string[] }>
  >(new Map());

  const [title, setTitle] = useState("");
  const [mediaType, setMediaType] = useState<EntryMediaType>("movie");
  const [isMovie, setIsMovie] = useState(false); // For "Anime" -> "Movie" checkbox
  const [status, setStatus] = useState<EntryStatus>("unspecified");
  const [userRating, setUserRating] = useState<string>("");
  const [imdbRating, setImdbRating] = useState<string>("");
  const [releaseYear, setReleaseYear] = useState<string>("");
  const [lengthMinutes, setLengthMinutes] = useState<string>("");
  const [episodeCount, setEpisodeCount] = useState<string>("");
  const [chapterCount, setChapterCount] = useState<string>("");

  // Game fields
  const [playTime, setPlayTime] = useState<string>("");
  const [achievements, setAchievements] = useState<string>("");
  const [totalAchievements, setTotalAchievements] = useState<string>("");
  const [platform, setPlatform] = useState("");
  const [isCustomPlatform, setIsCustomPlatform] = useState(false);

  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState<string>("");
  const [description, setDescription] = useState("");
  const [completionDate, setCompletionDate] = useState("");
  const [completionUnknown, setCompletionUnknown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [externalId, setExternalId] = useState<string | null>(null);
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);
  const [duplicateToast, setDuplicateToast] = useState<{
    id: number;
    message: string;
  } | null>(null);

  const [originalRelations, setOriginalRelations] = useState<
    { targetId: string; type: string; createdAtMs: number }[]
  >([]);
  const [relations, setRelations] = useState<EditableRelation[]>([]);
  const [isRelationSearchOpen, setIsRelationSearchOpen] = useState(false);
  const [relationSearchQuery, setRelationSearchQuery] = useState("");
  const [selectedRelationDoc, setSelectedRelationDoc] = useState<EntryDoc | null>(null);
  const [selectedRelationType, setSelectedRelationType] = useState<RelationType>("Sequel");

  const [lists, setLists] = useState<
    { id: string; name: string; type: ListMediaType; types: ListMediaType[] }[]
  >([]);

  // Multi-list support
  const [selectedListIds, setSelectedListIds] = useState<Set<string>>(new Set());
  const [initialListIds, setInitialListIds] = useState<Set<string>>(new Set()); // For tracking changes

  const [isNewListOpen, setIsNewListOpen] = useState(false);
  // Remnants of old logic, might remove or repurpose if needed
  // const [currentListId, setCurrentListId] = useState<string | null>(null);
  // const [currentListName, setCurrentListName] = useState("");
  // const [currentListItemId, setCurrentListItemId] = useState<string | null>(null);
  // const [showListChange, setShowListChange] = useState(false);

  const uid = user?.uid || null;

  const [activeField, setActiveField] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [currentEpisodes, setCurrentEpisodes] = useState("");
  const [currentSeasons, setCurrentSeasons] = useState("");
  const [totalSeasons, setTotalSeasons] = useState("");
  const [currentChapters, setCurrentChapters] = useState("");
  const [totalChapters, setTotalChapters] = useState("");
  const [currentPlaytime, setCurrentPlaytime] = useState("");
  const [rewatchCount, setRewatchCount] = useState(0);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isOpen]);


  const initializedRef = useRef<string | number | null>(null);
  const fetchedListIdsForEntryRef = useRef<string | number | null>(null);

  useEffect(() => {
    if (!uid || !isOpen) {
      setLists([]);
      return;
    }

    const q = query(collection(db, "users", uid, "lists"), orderBy("createdAt", "desc"), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLists(
        snapshot.docs.map((doc) => {
          const data = doc.data() as {
            name?: string;
            type?: string;
            types?: string[];
          };
          const singleType = (
            data.type === "movie" ||
              data.type === "series" ||
              data.type === "anime" ||
              data.type === "manga" ||
              data.type === "game"
              ? data.type
              : "movie"
          ) as ListMediaType;
          const types = (
            Array.isArray(data.types)
              ? data.types.filter((t): t is ListMediaType =>
                ["movie", "series", "anime", "manga", "game"].includes(t),
              )
              : [singleType]
          ) as ListMediaType[];
          return {
            id: doc.id,
            name: data.name || "Untitled List",
            type: singleType,
            types,
          };
        }),
      );
    });

    return () => unsubscribe();
  }, [uid, isOpen]);

  const runSearch = async (queryValue: string, typeValue: EntryMediaType) => {
    if (!queryValue.trim()) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }

    const key = `${queryValue.trim().toLowerCase()}|${typeValue}`;
    const cached = cacheRef.current.get(key);
    const now = Date.now();

    if (cached && now - cached.timestamp < 1000 * 60 * 5) {
      setSearchResults(cached.results);
      setSearchError(cached.errors && cached.errors.length > 0 ? cached.errors[0] : null);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsSearching(true);
    setSearchError(null);
    setSearchResults([]);

    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(queryValue.trim())}&type=${typeValue}`,
        {
          signal: controller.signal,
        },
      );
      if (!res.ok) {
        throw new Error(
          res.status === 429 ? "Search is rate limited. Try again shortly." : "Search failed.",
        );
      }
      const data = (await res.json()) as SearchResponse;
      setSearchResults(data.results || []);
      if (data.errors && data.errors.length > 0) {
        setSearchError(data.errors[0]);
      }

      cacheRef.current.set(key, {
        timestamp: now,
        results: data.results || [],
        errors: data.errors || [],
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setSearchResults([]);
      setSearchError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectResult = async (result: SearchResult) => {
    setTitle(result.title);
    setMediaType(result.type);
    setReleaseYear(result.year || "");
    setDescription(sanitizeImportedDescription(result.overview || ""));
    setImage(result.image || null);
    setExternalId(result.id);
    if (result.rating) {
      setImdbRating(result.rating.toFixed(1));
    }
    setActiveTab("manual");
    setSearchResults([]);
    setSearchQuery("");

    setIsFetchingMetadata(true);
    try {
      const params = new URLSearchParams({
        type: result.type,
        id: String(result.id),
        title: result.title,
      });
      if (result.year) params.set("year", result.year);

      const res = await fetch(`/api/metadata?${params.toString()}`);
      if (res.ok) {
        const payload = await res.json();
        const data = payload.data;
        if (data) {
          if (data.description) setDescription(sanitizeImportedDescription(data.description));
          if (data.year) setReleaseYear(data.year);
          if (data.rating) setImdbRating(data.rating.toFixed(1));
          if (data.lengthMinutes) setLengthMinutes(String(data.lengthMinutes));
          if (data.episodeCount) setEpisodeCount(String(data.episodeCount));
          if (data.chapterCount) setChapterCount(String(data.chapterCount));
          if (data.genresThemes && Array.isArray(data.genresThemes)) {
            setTags(data.genresThemes.slice(0, 10));
          }
          if (data.image) setImage(data.image);
          if (data.type === "movie" && data.genresThemes?.includes("Anime")) {
            // Heuristic for anime movie if needed
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch metadata:", err);
    } finally {
      setIsFetchingMetadata(false);
    }
  };

  const normalizedInitial = useMemo(() => {
    if (!initialMedia) return null;
    const inferredType: EntryMediaType =
      initialMedia.type === "anime"
        ? "anime"
        : initialMedia.type === "anime_movie"
          ? "anime" // Normalize to anime
          : initialMedia.type === "manga"
            ? "manga"
            : initialMedia.type === "game"
              ? "game"
              : initialMedia.type === "series"
                ? "series"
                : "movie";

    // Check if it was anime_movie to set isMovie flag
    const isMovieFlag = initialMedia.type === "anime_movie" || initialMedia.isMovie;

    return { ...initialMedia, inferredType, inferredIsMovie: isMovieFlag };
  }, [initialMedia]);

  const listMediaType = mediaType;
  const listDefaultType = mediaType;

  const availableLists = useMemo(() => {
    // Show all lists that accept this media type
    return lists.filter((list) => list.types.includes(listMediaType));
  }, [lists, listMediaType]);
  const relatedTargetIdSet = useMemo(
    () => new Set(relations.map((relation) => relation.targetId)),
    [relations],
  );

  // Effect to find which lists this item is in
  useEffect(() => {
    // Only run this synchronization logic if we are editing an existing item
    if (!uid || !isOpen || !isEditing || !normalizedInitial?.id) {
      return;
    }

    if (lists.length === 0) return;

    // Only fetch once per entry ID to avoid clobbering new list selections
    if (fetchedListIdsForEntryRef.current === normalizedInitial.id) return;

    let cancelled = false;
    const entryId = String(normalizedInitial.id);

    const findLists = async () => {
      // If we have listIds from the entry itself (future proof), use them
      if (normalizedInitial.listIds && normalizedInitial.listIds.length > 0) {
        if (cancelled) return;
        const ids = new Set(normalizedInitial.listIds);
        setSelectedListIds(ids);
        setInitialListIds(ids);
        return;
      }

      // Backward compatibility: check all lists
      const foundIds = new Set<string>();

      // We can parallelize this
      const checks = lists.map(async (list) => {
        // Optimization: Checking all lists might be heavy if user has many lists.
        // But for < 50 lists it's probably fine.
        const itemsQuery = query(
          collection(db, "users", uid, "lists", list.id, "items"),
          where("externalId", "==", entryId),
          limit(1),
        );
        const snapshot = await getDocs(itemsQuery);
        if (!snapshot.empty) {
          return list.id;
        }
        return null;
      });

      const results = await Promise.all(checks);
      if (cancelled) return;

      results.forEach((id) => {
        if (id) foundIds.add(id);
      });

      setSelectedListIds(foundIds);
      setInitialListIds(foundIds);
      fetchedListIdsForEntryRef.current = normalizedInitial.id;
    };

    findLists();

    return () => {
      cancelled = true;
    };
  }, [uid, isOpen, isEditing, normalizedInitial?.id, normalizedInitial?.listIds, lists]);

  useEffect(() => {
    if (!isOpen) {
      initializedRef.current = null;
      fetchedListIdsForEntryRef.current = null;
      setDuplicateToast(null);
      return;
    }

    // If we have a normalized initial value and we haven't initialized for this ID yet
    if (normalizedInitial) {
      // If we already initialized for this specific entry ID, don't re-initialize
      // This prevents the form from resetting when the parent component re-renders
      if (normalizedInitial.id && initializedRef.current === normalizedInitial.id) {
        return;
      }

      initializedRef.current = normalizedInitial.id;

      setError(null);
      setInfo(null);
      setSearchQuery("");
      setSearchResults([]);
      setSearchError(null);

      setActiveTab(normalizedInitial ? "manual" : isEditing ? "manual" : "search");
      setTitle(normalizedInitial.title);
      setMediaType(normalizedInitial.inferredType);
      setIsMovie(!!normalizedInitial.inferredIsMovie);
      setStatus(normalizedInitial.status || "unspecified");

      const initialUserRating =
        typeof normalizedInitial.userRating === "number"
          ? normalizedInitial.userRating
          : isEditing && typeof normalizedInitial.rating === "number"
            ? normalizedInitial.rating
            : null;
      if (
        typeof initialUserRating === "number" &&
        initialUserRating >= 1 &&
        initialUserRating <= 10
      ) {
        setUserRating(String(Math.round(initialUserRating)));
      } else {
        setUserRating("");
      }

      const initialImdbRating =
        typeof normalizedInitial.imdbRating === "number"
          ? normalizedInitial.imdbRating
          : typeof normalizedInitial.rating === "number"
            ? normalizedInitial.rating
            : null;
      if (
        typeof initialImdbRating === "number" &&
        initialImdbRating >= 0 &&
        initialImdbRating <= 10
      ) {
        setImdbRating(String(initialImdbRating));
      } else {
        setImdbRating("");
      }

      setReleaseYear(normalizedInitial.releaseYear || normalizedInitial.year || "");
      setLengthMinutes(
        normalizedInitial.lengthMinutes ? String(normalizedInitial.lengthMinutes) : "",
      );
      setEpisodeCount(normalizedInitial.episodeCount ? String(normalizedInitial.episodeCount) : "");
      setChapterCount(normalizedInitial.chapterCount ? String(normalizedInitial.chapterCount) : "");

      setPlayTime(normalizedInitial.playTime ? String(normalizedInitial.playTime) : "");
      setAchievements(normalizedInitial.achievements ? String(normalizedInitial.achievements) : "");
      setTotalAchievements(
        normalizedInitial.totalAchievements ? String(normalizedInitial.totalAchievements) : "",
      );
      const isPredefined = PLATFORM_OPTIONS.some((p) => p.id === normalizedInitial.platform);
      if (normalizedInitial.platform && !isPredefined) {
        setIsCustomPlatform(true);
      } else {
        setIsCustomPlatform(false);
      }
      setPlatform(normalizedInitial.platform || "");

      setTags(
        Array.isArray(normalizedInitial.genresThemes)
          ? normalizedInitial.genresThemes.slice(0, 10)
          : [],
      );
      setTagInput("");
      setDescription(normalizedInitial.description || "");
      setImage(normalizedInitial.image || null);
      setExternalId(normalizedInitial.id ? String(normalizedInitial.id) : null);

      if (normalizedInitial.status === "completed") {
        if (normalizedInitial.completionDateUnknown) {
          setCompletionUnknown(true);
          setCompletionDate("");
        } else if (normalizedInitial.completedAt) {
          setCompletionUnknown(false);
          setCompletionDate(formatISODate(normalizedInitial.completedAt));
        } else {
          setCompletionUnknown(false);
          setCompletionDate("");
        }
      } else {
        setCompletionDate("");
        setCompletionUnknown(false);
      }
      // List IDs set by other effect

      if (normalizedInitial.relations) {
        const initialRelations = normalizedInitial.relations
          .filter((relation) => relation.inferred !== true)
          .map((relation) => ({
            targetId: String(relation.targetId || "").trim(),
            type: String(relation.type || "").trim(),
            createdAtMs:
              typeof relation.createdAtMs === "number" && Number.isFinite(relation.createdAtMs)
                ? relation.createdAtMs
                : Date.now(),
          }))
          .filter((relation) => Boolean(relation.targetId) && Boolean(relation.type));

        setOriginalRelations(initialRelations);
        setRelations(buildEditableRelations(initialRelations, entries));
      } else {
        setOriginalRelations([]);
        setRelations([]);
      }
    } else if (initializedRef.current !== "new") {
      // Only reset if we haven't initialized "new" state yet
      initializedRef.current = "new";

      setError(null);
      setInfo(null);
      setSearchQuery("");
      setSearchResults([]);
      setSearchError(null);

      setActiveTab("search"); // Default to search for new entries
      setTitle("");
      setMediaType("movie");
      setIsMovie(false);
      setStatus("unspecified");
      setUserRating("");
      setImdbRating("");
      setReleaseYear("");
      setLengthMinutes("");
      setEpisodeCount("");
      setChapterCount("");
      setPlayTime("");
      setAchievements("");
      setTotalAchievements("");
      setPlatform("");
      setTags([]);
      setTagInput("");
      setDescription("");
      setCompletionDate("");
      setCompletionUnknown(false);
      setImage(null);
      setExternalId(null);
      setSelectedListIds(new Set());
      setInitialListIds(new Set());
      setOriginalRelations([]);
      setRelations([]);
    }
  }, [isOpen, normalizedInitial, entries, isEditing]);

  useEffect(() => {
    if (!isOpen) return;
    if (relations.length === 0) return;

    setRelations((prev) => {
      let changed = false;
      const next = prev.map((relation) => {
        const match = entries.find((entry) => String(entry.id) === relation.targetId);
        if (!match) return relation;
        if (
          relation.title === match.title &&
          relation.image === match.image &&
          relation.mediaType === match.mediaType
        ) {
          return relation;
        }
        changed = true;
        return {
          ...relation,
          title: match.title,
          image: match.image,
          mediaType: match.mediaType,
        };
      });

      return changed ? next : prev;
    });
  }, [entries, isOpen, relations.length]);

  useEffect(() => {
    if (!isOpen) return;
    if (status !== "completed") {
      if (completionDate) setCompletionDate("");
      if (completionUnknown) setCompletionUnknown(false);
      return;
    }
    if (!completionUnknown && !completionDate) {
      setCompletionDate(todayISODate());
    }
  }, [status, isOpen, completionDate, completionUnknown]);

  const userRatingError = useMemo(() => {
    const raw = userRating.trim();
    if (!raw) return null;
    if (!/^\d+$/.test(raw)) return "Rating must be a whole number from 1 to 10.";
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 1 || value > 10)
      return "Rating must be between 1 and 10.";
    return null;
  }, [userRating]);

  const imdbRatingError = useMemo(() => {
    const raw = imdbRating.trim();
    if (!raw) return null;
    if (!/^\d+(\.\d{1,2})?$/.test(raw)) return "IMDb rating must be a number from 0 to 10.";
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || value > 10)
      return "IMDb rating must be between 0 and 10.";
    return null;
  }, [imdbRating]);

  const releaseYearError = useMemo(() => {
    const raw = releaseYear.trim();
    if (!raw) return null;
    if (!/^\d{4}$/.test(raw)) return "Release year must be a 4-digit year.";
    const value = Number(raw);
    const currentYear = new Date().getFullYear() + 1;
    if (value < 1888 || value > currentYear) return "Release year must be a valid year.";
    return null;
  }, [releaseYear]);

  const numericField = useMemo(() => {
    if (mediaType === "movie" || (mediaType === "anime" && isMovie))
      return {
        key: "lengthMinutes" as const,
        label: "Length (minutes)",
        value: lengthMinutes,
      };
    if (mediaType === "series" || mediaType === "anime")
      return {
        key: "episodeCount" as const,
        label: "Number of episodes",
        value: episodeCount,
      };
    if (mediaType === "manga")
      return {
        key: "chapterCount" as const,
        label: "Number of chapters",
        value: chapterCount,
      };
    // Games handled separately now
    return null;
  }, [chapterCount, episodeCount, lengthMinutes, mediaType, isMovie]);

  const numericFieldError = useMemo(() => {
    if (!numericField) return null;
    const raw = numericField.value.trim();
    if (!raw) return null;
    if (!/^\d+$/.test(raw)) return `${numericField.label} must be a positive integer.`;
    const value = Number(raw);
    if (!Number.isInteger(value) || value <= 0)
      return `${numericField.label} must be a positive integer.`;
    return null;
  }, [numericField]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
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
      setError(userRatingError || imdbRatingError || releaseYearError);
      return;
    }
    const userRatingValue = userRating.trim() ? Number(userRating.trim()) : null;
    const imdbRatingValue = imdbRating.trim() ? Number(imdbRating.trim()) : null;
    const releaseYearValue = releaseYear.trim() ? releaseYear.trim() : null;

    if (numericFieldError) {
      setError(numericFieldError);
      return;
    }
    const lengthMinutesValue =
      mediaType === "movie" || (mediaType === "anime" && isMovie)
        ? lengthMinutes.trim()
          ? Number(lengthMinutes.trim())
          : null
        : null;
    const episodeCountValue =
      mediaType === "series" || mediaType === "anime"
        ? episodeCount.trim()
          ? Number(episodeCount.trim())
          : null
        : null;
    const chapterCountValue =
      mediaType === "manga" ? (chapterCount.trim() ? Number(chapterCount.trim()) : null) : null;

    // Game fields
    const playTimeValue =
      mediaType === "game" ? (playTime.trim() ? Number(playTime.trim()) : null) : null;
    const achievementsValue =
      mediaType === "game" ? (achievements.trim() ? Number(achievements.trim()) : null) : null;
    const totalAchievementsValue =
      mediaType === "game"
        ? totalAchievements.trim()
          ? Number(totalAchievements.trim())
          : null
        : null;
    const platformValue = mediaType === "game" ? (platform.trim() ? platform.trim() : null) : null;

    if (tags.length > 10) {
      setError("You can only add up to 10 genres/themes.");
      return;
    }

    let completedAt: Timestamp | null = null;
    let completionDateUnknownValue = false;
    if (status === "completed") {
      completionDateUnknownValue = completionUnknown;
      if (!completionUnknown) {
        const parsed = parseISODate(completionDate.trim());
        if (!parsed) {
          setError("Completion date must be a valid date.");
          return;
        }
        const now = new Date();
        const endOfToday = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          23,
          59,
          59,
          999,
        ).getTime();
        if (parsed.millis > endOfToday) {
          setError("Completion date cannot be in the future.");
          return;
        }
        completedAt = Timestamp.fromDate(parsed.date);
      }
    }

    const effectiveSelectedListIds = selectedListIds;

    // Validate lists
    if (effectiveSelectedListIds.size > 0) {
      for (const id of effectiveSelectedListIds) {
        const list = lists.find((l) => l.id === id);
        if (list && !list.types.includes(listMediaType)) {
          // Allow saving but maybe warn? Or just filter out?
          // Strict mode:
          setError(`List "${list.name}" does not accept ${listMediaType} items.`);
          return;
        }
      }
    }

    if (!isEditing) {
      const candidateTitleLower = trimmedTitle.toLowerCase();
      const duplicateExists = entries.some((e) => {
        if (externalId && String(e.externalId) === String(externalId)) return true;
        if (e.mediaType !== mediaType) return false;
        if (e.title.toLowerCase() !== candidateTitleLower) return false;
        const eYear = e.releaseYear || e.year || "";
        const rYear = releaseYearValue || "";
        if (eYear && rYear && eYear !== rYear) return false;
        return true;
      });

      if (duplicateExists) {
        setError("This item already exists.");
        setDuplicateToast({
          id: Date.now(),
          message: `"${trimmedTitle}" already exists in your library.`,
        });
        return;
      }
    }

    setIsSaving(true);
    try {
      const entryId = isEditing && normalizedInitial?.id ? String(normalizedInitial.id) : null;
      const relationPayload = relations.reduce<
        { targetId: string; type: string; createdAtMs: number }[]
      >((acc, relation) => {
        if (!relation.targetId || !relation.type) return acc;
        if (acc.some((existing) => existing.targetId === relation.targetId)) return acc;
        acc.push({
          targetId: relation.targetId,
          type: relation.type,
          createdAtMs: Date.now(),
        });
        return acc;
      }, []);

      // 1. Save/Update Entry
      const entryData = {
        title: trimmedTitle,
        mediaType,
        status,
        userRating: userRatingValue,
        imdbRating: imdbRatingValue,
        releaseYear: releaseYearValue,
        lengthMinutes: lengthMinutesValue,
        episodeCount: episodeCountValue,
        chapterCount: chapterCountValue,
        // New game fields
        playTime: playTimeValue,
        achievements: achievementsValue,
        totalAchievements: totalAchievementsValue,
        platform: platformValue,
        isMovie: isMovie,

        genresThemes: tags,
        description: description.trim(),
        image: image,
        year: releaseYearValue,
        completedAt,
        completionDateUnknown: completionDateUnknownValue,
        updatedAt: serverTimestamp(),
        listIds: Array.from(effectiveSelectedListIds), // Save list relationships in entry
        relations: relationPayload,
      };

      let finalEntryId = entryId;

      if (isEditing && entryId) {
        const entryRef = doc(db, "users", uid, "entries", entryId);
        await updateDoc(entryRef, entryData);
        setInfo("Updated.");
      } else {
        const entryRef = await addDoc(collection(db, "users", uid, "entries"), {
          ...entryData,
          externalId: externalId, // Only for new entries
          createdAt: serverTimestamp(),
        });
        finalEntryId = entryRef.id;
        setInfo("Saved.");
      }

      if (!finalEntryId) throw new Error("Failed to get entry ID");

      // 2. Handle Lists (Add/Remove)
      const addedIds = Array.from(effectiveSelectedListIds).filter((id) => !initialListIds.has(id));
      const removedIds = Array.from(initialListIds).filter(
        (id) => !effectiveSelectedListIds.has(id),
      );
      const commonIds = Array.from(effectiveSelectedListIds).filter((id) => initialListIds.has(id));

      // Batch or Parallel processing? Parallel is fine for Firestore
      const promises = [];

      // Add to new lists
      for (const listId of addedIds) {
        promises.push(
          addDoc(collection(db, "users", uid, "lists", listId, "items"), {
            title: trimmedTitle,
            mediaType: listMediaType,
            externalId: finalEntryId,
            image: image,
            year: releaseYearValue,
            addedAt: serverTimestamp(),
          }).then(() => {
            return updateDoc(doc(db, "users", uid, "lists", listId), {
              updatedAt: serverTimestamp(),
            });
          }),
        );
      }

      // Remove from old lists
      for (const listId of removedIds) {
        // We need to find the item ID in that list using externalId
        promises.push(
          (async () => {
            const q = query(
              collection(db, "users", uid, "lists", listId, "items"),
              where("externalId", "==", finalEntryId),
              limit(1),
            );
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
              await deleteDoc(doc(db, "users", uid, "lists", listId, "items", snapshot.docs[0].id));
              await updateDoc(doc(db, "users", uid, "lists", listId), {
                updatedAt: serverTimestamp(),
              });
            }
          })(),
        );
      }

      // Update existing items in lists (commonIds) to reflect title/image changes
      for (const listId of commonIds) {
        promises.push(
          (async () => {
            const q = query(
              collection(db, "users", uid, "lists", listId, "items"),
              where("externalId", "==", finalEntryId),
              limit(1),
            );
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
              await updateDoc(
                doc(db, "users", uid, "lists", listId, "items", snapshot.docs[0].id),
                {
                  title: trimmedTitle,
                  mediaType: listMediaType,
                  image: image,
                  year: releaseYearValue,
                },
              );
            }
          })(),
        );
      }

      await Promise.all(promises);

      const relationsToSave = relationPayload.map((relation) => ({
        targetId: relation.targetId,
        type: relation.type,
      }));
      await updateBidirectionalRelations(uid, finalEntryId, originalRelations, relationsToSave);

      if (!isEditing) {
        // Reset form
        setTitle("");
        setUserRating("");
        setImdbRating("");
        setReleaseYear("");
        setLengthMinutes("");
        setEpisodeCount("");
        setChapterCount("");

        setPlayTime("");
        setAchievements("");
        setTotalAchievements("");
        setPlatform("");
        setIsMovie(false);

        setTags([]);
        setTagInput("");
        setDescription("");
        setCompletionDate("");
        setCompletionUnknown(false);

        setSelectedListIds(new Set());
        setInitialListIds(new Set());
        setOriginalRelations([]);
        setRelations([]);
        setIsRelationSearchOpen(false);
        setRelationSearchQuery("");
        setSelectedRelationDoc(null);

        setImage(null);
        setExternalId(null);

        setActiveTab("search");
        // Don't close immediately allows adding more
      } else {
        setTimeout(() => onClose(), 1000);
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to save entry.");
    } finally {
      setIsSaving(false);
    }
  };

  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      const handleEsc = (e: KeyboardEvent) => {
        if (e.key === "Escape") onClose();
      };
      window.addEventListener("keydown", handleEsc);
      return () => {
        document.body.style.overflow = "unset";
        window.removeEventListener("keydown", handleEsc);
      };
    }
  }, [isOpen, onClose]);

  useEffect(() => {
    if (activeTab === "search") {
      inputRef.current?.focus();
    }
  }, [activeTab]);

  const SectionHeader = ({ title }: { title: string }) => (
    <div className="mt-8 mb-4 first:mt-0">
      <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#555] mb-2">{title}</div>
      <div className="h-[1px] w-full bg-white/5" />
    </div>
  );

  const StatColumn = ({ label, value }: { label: string; value: string }) => (
    <div className="flex flex-col gap-1">
      <div className="text-[9px] font-mono uppercase tracking-[0.1em] text-[#555]">{label}</div>
      <div className="text-[22px] font-extrabold text-white leading-none tracking-tight">{value}</div>
    </div>
  );

  const EditableField = ({ 
    label, 
    value, 
    children, 
    fieldId 
  }: { 
    label: string; 
    value: string | React.ReactNode; 
    children: React.ReactNode; 
    fieldId: string;
  }) => {
    const isActive = activeField === fieldId;
    return (
      <div className="group relative mb-6">
        <div className="flex justify-between items-center mb-1.5">
          <label className="text-[10px] font-mono uppercase tracking-[0.12em] text-[#555]">{label}</label>
          <button 
            type="button" 
            onClick={() => setActiveField(isActive ? null : fieldId)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 -m-1"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
          </button>
        </div>
        <div onClick={() => !isActive && setActiveField(fieldId)} className={!isActive ? "cursor-pointer" : ""}>
          {isActive ? children : (
            <div className="text-[14px] text-white/90 font-medium">{value || <span className="text-[#333]">NOT SET</span>}</div>
          )}
        </div>
      </div>
    );
  };

  const ProgressField = ({ 
    label, 
    current, 
    total, 
    onCurrentChange, 
    onTotalChange,
    fieldId
  }: { 
    label: string; 
    current: string; 
    total: string; 
    onCurrentChange: (v: string) => void; 
    onTotalChange: (v: string) => void;
    fieldId: string;
  }) => (
    <EditableField 
      label={label} 
      fieldId={fieldId}
      value={`${current || '0'} / ${total || '—'}`}
    >
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={current}
          onChange={(e) => onCurrentChange(e.target.value)}
          placeholder="0"
          className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg py-2.5 px-3.5 text-sm text-white focus:outline-none focus:border-white/20 transition-all"
        />
        <span className="text-[#333] font-mono">/</span>
        <input
          type="text"
          value={total}
          onChange={(e) => onTotalChange(e.target.value)}
          placeholder="—"
          className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg py-2.5 px-3.5 text-sm text-white focus:outline-none focus:border-white/20 transition-all"
        />
      </div>
    </EditableField>
  );

  const DateField = ({ 
    label, 
    value, 
    onChange, 
    onToday, 
    onUnknown, 
    unknownChecked,
    fieldId
  }: { 
    label: string; 
    value: string; 
    onChange: (v: string) => void; 
    onToday: () => void; 
    onUnknown: () => void;
    unknownChecked?: boolean;
    fieldId: string;
  }) => (
    <EditableField 
      label={label} 
      fieldId={fieldId}
      value={unknownChecked ? "UNKNOWN" : value || "NOT SET"}
    >
      <div className="flex flex-col gap-2">
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={unknownChecked}
          className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg py-3 px-4 text-sm text-white focus:outline-none focus:border-white/20 transition-all disabled:opacity-50"
        />
        <div className="flex gap-4">
          <button type="button" onClick={onToday} className="text-[10px] font-mono uppercase tracking-[0.1em] text-[#555] hover:text-white transition-colors">SET TODAY</button>
          <button type="button" onClick={onUnknown} className={cn("text-[10px] font-mono uppercase tracking-[0.1em] transition-colors", unknownChecked ? "text-white" : "text-[#555] hover:text-white")}>UNKNOWN</button>
        </div>
      </div>
    </EditableField>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/75 backdrop-blur-sm">
      <div className="relative w-full max-w-[1000px] h-[720px] max-h-[90vh] bg-[#111] rounded-2xl overflow-hidden flex flex-col shadow-2xl border border-white/5">
        <form onSubmit={onSubmit} className="flex flex-col h-full overflow-hidden">
          {/* Main Panels */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left Panel: Media info */}
            <div className="w-[420px] shrink-0 border-r border-white/5 overflow-y-auto custom-scrollbar p-7 flex flex-col bg-[#111]">
              <div className="flex justify-between items-center mb-4">
                <span className="text-[10px] font-mono text-[#555] uppercase tracking-[0.14em]">CULTURAL LEGACY</span>
                <span className="px-3 py-1 rounded-full border border-white/10 text-[11px] font-mono text-white/50 uppercase tracking-wider">{mediaType}</span>
              </div>

              <div className="relative w-full aspect-[16/10] rounded-xl overflow-hidden mb-6 bg-[#1f1f1f]">
                {image ? (
                  <ImageWithSkeleton src={image} alt={title} fill className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#333]">
                    <Search className="w-8 h-8 opacity-20" />
                  </div>
                )}
              </div>

              <h1 className="text-[clamp(28px,4vw,40px)] font-black leading-[1.1] uppercase tracking-[-0.02em] text-white mb-2">{title || "Untitled Project"}</h1>
              <div className="text-sm text-[#666] mb-8">Directed by — · {releaseYear || "—"}</div>

              <div className="grid grid-cols-3 gap-6 mb-8">
                <StatColumn label="EPISODES" value={episodeCount || "—"} />
                <StatColumn label="SEASONS" value="01" />
                <StatColumn label="RATING" value={imdbRating ? `★${imdbRating}` : "—"} />
              </div>

              <div className="flex flex-wrap gap-1.5 mb-6">
                {tags.map((tag) => (
                  <span key={tag} className="px-3 py-1 rounded-full border border-white/[0.08] bg-[#1a1a1a] text-[10px] text-[#aaa] font-mono uppercase tracking-[0.08em]">
                    {tag}
                  </span>
                ))}
              </div>

              <p className="text-[13px] text-[#555] leading-[1.6] italic line-clamp-3">
                {description || "No description available for this protocol."}
              </p>
            </div>

            {/* Right Panel: Inputs */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-7 bg-[#111]">
              {activeTab === "search" ? (
                /* Search View */
                <div className="flex flex-col h-full">
                  <div className="flex gap-2 mb-6">
                    <div className="relative flex-1">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555]" />
                      <input
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          runSearch(e.target.value, searchType);
                        }}
                        placeholder="Search archives..."
                        className="w-full bg-[#1a1a1a] border border-white/5 rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder-[#444] focus:outline-none focus:border-white/10"
                        ref={inputRef}
                      />
                    </div>
                    <select
                      value={searchType}
                      onChange={(e) => {
                        const next = e.target.value as EntryMediaType;
                        setSearchType(next);
                        runSearch(searchQuery, next);
                      }}
                      className="bg-[#1a1a1a] border border-white/5 rounded-xl px-4 text-xs font-mono text-[#888] focus:outline-none"
                    >
                      {(["movie", "series", "anime", "manga", "game"] as EntryMediaType[]).map((t) => (
                        <option key={t} value={t}>{t.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex-1 space-y-2">
                    {isSearching ? (
                      <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#333]" /></div>
                    ) : searchResults.length > 0 ? (
                      searchResults.map((result) => (
                        <button
                          key={result.id}
                          type="button"
                          onClick={() => handleSelectResult(result)}
                          className="w-full flex gap-4 p-3 rounded-xl hover:bg-white/[0.02] border border-transparent hover:border-white/[0.05] transition-all text-left group"
                        >
                          <div className="w-14 h-20 bg-[#1a1a1a] rounded overflow-hidden shrink-0">
                            {result.image && <ImageWithSkeleton src={result.image} alt="" fill className="object-cover" />}
                          </div>
                          <div className="flex-1 pt-1">
                            <div className="text-white text-[13px] font-medium group-hover:text-white transition-colors">{result.title}</div>
                            <div className="text-[11px] text-[#555] font-mono mt-0.5">{result.year} · {result.type.toUpperCase()}</div>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="py-20 text-center text-[#333] font-mono text-[11px] tracking-widest">INITIALIZING SEARCH FIELD</div>
                    )}
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => setActiveTab("manual")}
                    className="mt-6 w-full py-3 rounded-xl border border-dashed border-white/10 text-[10px] font-mono text-[#555] hover:text-[#888] hover:border-white/20 transition-all uppercase tracking-[0.12em]"
                  >
                    Enter manual data
                  </button>
                </div>
              ) : (
                /* Manual Data Entry View */
                <div className="pb-8">
                  <SectionHeader title="Status & Progress" />
                  
                  <EditableField 
                    label="Current Status" 
                    fieldId="status" 
                    value={statusLabels[status]}
                  >
                    <div className="relative">
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as EntryStatus)}
                        className="w-full bg-[#1a1a1a] border border-white/10 rounded-full py-2.5 px-4 pr-10 appearance-none text-sm text-white focus:outline-none"
                      >
                        <option value="unspecified">Unspecified</option>
                        {(mediaType === "game" ? GAME_STATUS_OPTIONS : STANDARD_STATUS_OPTIONS).map(s => (
                          <option key={s} value={s}>{statusLabels[s]}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555] pointer-events-none" />
                    </div>
                  </EditableField>

                  <EditableField
                    label="Score"
                    fieldId="score"
                    value={userRating || "—"}
                  >
                    <div className="bg-[#1a1a1a] p-4 rounded-xl border border-white/5">
                      <div className="flex justify-between items-baseline mb-4">
                        <span className="text-[10px] font-mono text-[#555] tracking-widest">SCORE</span>
                        <span className="text-xl font-black text-white">{userRating || "0.0"}</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" max="10" step="0.1" 
                        value={userRating || 0}
                        onChange={(e) => setUserRating(e.target.value)}
                        className="w-full h-1 bg-[#2a2a2a] rounded-lg appearance-none cursor-pointer accent-white"
                      />
                    </div>
                  </EditableField>

                  {mediaType === "series" || mediaType === "anime" ? (
                    <ProgressField 
                      label="Episode" 
                      fieldId="episodes"
                      current={currentEpisodes} 
                      total={episodeCount} 
                      onCurrentChange={setCurrentEpisodes}
                      onTotalChange={setEpisodeCount}
                    />
                  ) : mediaType === "manga" ? (
                    <ProgressField 
                      label="Chapter" 
                      fieldId="chapters"
                      current={currentChapters} 
                      total={chapterCount} 
                      onCurrentChange={setCurrentChapters}
                      onTotalChange={setChapterCount}
                    />
                  ) : null}

                  <ProgressField 
                    label="Season" 
                    fieldId="seasons"
                    current={currentSeasons} 
                    total={totalSeasons} 
                    onCurrentChange={setCurrentSeasons}
                    onTotalChange={setTotalSeasons}
                  />

                  <EditableField label="Rewatch Count" fieldId="rewatch" value={rewatchCount.toString()}>
                    <div className="flex items-center gap-4 bg-[#1a1a1a] p-3 rounded-xl border border-white/5 w-fit">
                      <button type="button" onClick={() => setRewatchCount(Math.max(0, rewatchCount - 1))} className="p-1 hover:text-white text-[#555] transition-colors"><X className="w-4 h-4 rotate-45"/></button>
                      <span className="text-sm font-bold text-white min-w-[20px] text-center">{rewatchCount}</span>
                      <button type="button" onClick={() => setRewatchCount(rewatchCount + 1)} className="p-1 hover:text-white text-[#555] transition-colors"><Plus className="w-4 h-4"/></button>
                    </div>
                  </EditableField>

                  <SectionHeader title="Archival Lists" />
                  <div className="flex flex-wrap gap-2 mb-8">
                    {availableLists.map((list) => (
                      <button
                        key={list.id}
                        type="button"
                        onClick={() => {
                          const next = new Set(selectedListIds);
                          if (next.has(list.id)) next.delete(list.id);
                          else next.add(list.id);
                          setSelectedListIds(next);
                        }}
                        className={cn(
                          "px-4 py-1.5 rounded-full text-[11px] font-mono tracking-wider transition-all border",
                          selectedListIds.has(list.id) 
                            ? "bg-white text-black border-white font-bold" 
                            : "bg-transparent text-[#aaa] border-white/10 hover:border-white/20"
                        )}
                      >
                        {list.name.toUpperCase()}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setIsNewListOpen(true)}
                      className="px-4 py-1.5 rounded-full text-[11px] font-mono tracking-wider border border-dashed border-white/10 text-[#555] hover:text-[#888] hover:border-white/20 transition-all"
                    >
                      + NEW LIST
                    </button>
                  </div>

                  <SectionHeader title="Archival Dates" />
                  <div className="grid grid-cols-2 gap-6 mb-8">
                    <DateField 
                      label="Date Started" 
                      fieldId="dateStarted"
                      value={startDate} 
                      onChange={setStartDate}
                      onToday={() => setStartDate(todayISODate())}
                      onUnknown={() => setStartDate("")}
                    />
                    <DateField 
                      label="Date Completed" 
                      fieldId="dateCompleted"
                      value={completionDate} 
                      onChange={setCompletionDate}
                      onToday={() => setCompletionDate(todayISODate())}
                      onUnknown={() => setCompletionUnknown(!completionUnknown)}
                      unknownChecked={completionUnknown}
                    />
                  </div>

                  <SectionHeader title="Relations" />
                  <div className="relative mb-4">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555]" />
                    <input
                      value={relationSearchQuery}
                      onChange={(e) => {
                        setRelationSearchQuery(e.target.value);
                        setSelectedRelationDoc(null);
                      }}
                      placeholder="Search for related media..."
                      className="w-full bg-[#1a1a1a] border border-white/5 rounded-lg py-3 pl-11 pr-4 text-[13px] text-white focus:outline-none focus:border-white/10"
                    />
                    {relationSearchQuery && !selectedRelationDoc && (
                      <div className="absolute top-full left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-[#1a1a1a] border border-white/10 rounded-lg shadow-2xl z-20">
                        {entries
                          .filter(e => e.title.toLowerCase().includes(relationSearchQuery.toLowerCase()) && String(e.id) !== String(normalizedInitial?.id))
                          .map(e => (
                            <button
                              key={e.id}
                              type="button"
                              onClick={() => { setSelectedRelationDoc(e); setRelationSearchQuery(e.title); }}
                              className="w-full text-left px-4 py-2 text-[12px] text-[#888] hover:bg-white/[0.03] hover:text-white"
                            >
                              {e.title}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {relations.map((rel, idx) => (
                      <div key={idx} className="flex items-center gap-3 bg-[#1a1a1a] border border-white/5 p-2 rounded-lg pr-3">
                        <div className="w-8 h-12 relative rounded overflow-hidden bg-[#222]">
                          {rel.image && <ImageWithSkeleton src={rel.image} alt="" fill className="object-cover" />}
                        </div>
                        <div className="flex-1">
                          <div className="text-[12px] text-white font-medium truncate max-w-[120px]">{rel.title}</div>
                          <div className="text-[10px] text-[#555] font-mono uppercase tracking-tight">{rel.type}</div>
                        </div>
                        <button type="button" onClick={() => setRelations(prev => prev.filter((_, i) => i !== idx))} className="text-[#333] hover:text-white transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {selectedRelationDoc && (
                    <div className="flex gap-2 p-3 bg-[#1a1a1a] rounded-lg border border-white/10 shadow-xl">
                      <select
                        value={selectedRelationType}
                        onChange={(e) => setSelectedRelationType(e.target.value as RelationType)}
                        className="flex-1 bg-black/20 border border-white/5 rounded px-3 text-[11px] text-white font-mono"
                      >
                        {RELATION_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          setRelations(prev => [...prev, {
                            targetId: String(selectedRelationDoc.id),
                            type: selectedRelationType,
                            title: selectedRelationDoc.title,
                            image: selectedRelationDoc.image,
                            mediaType: selectedRelationDoc.mediaType
                          }]);
                          setRelationSearchQuery("");
                          setSelectedRelationDoc(null);
                        }}
                        className="px-4 py-1.5 rounded-full bg-white text-black text-[9px] font-bold uppercase tracking-widest"
                      >
                        + ADD
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer Bar */}
          <div className="h-16 shrink-0 bg-[#111] border-top border-white/[0.06] px-6 flex items-center justify-between z-30">
            <button
              type="button"
              onClick={onClose}
              className="text-[11px] font-mono uppercase tracking-[0.12em] text-[#555] hover:text-[#888] transition-colors"
            >
              DISCARD DRAFT
            </button>
            <div className="text-[11px] font-mono uppercase tracking-[0.12em] text-[#333]">
              PRESS ESC TO EXIT
            </div>
            <button
              type="submit"
              disabled={isSaving}
              className="bg-white text-[#111] px-7 py-2.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-[0.14em] hover:bg-neutral-200 transition-colors disabled:opacity-50"
            >
              {isSaving ? "SAVING..." : "SAVE ENTRY"}
            </button>
          </div>
        </form>
      </div>

      <NewListModal
        isOpen={isNewListOpen}
        onClose={() => setIsNewListOpen(false)}
        defaultType={listDefaultType}
        onCreated={(list) => {
          const next = new Set(selectedListIds);
          next.add(list.id);
          setSelectedListIds(next);
        }}
      />
      
      <InfographicToast
        isOpen={Boolean(duplicateToast)}
        title="Duplicate Detected"
        message={duplicateToast?.message || ""}
        onClose={() => setDuplicateToast(null)}
      />
    </div>
  );
}
