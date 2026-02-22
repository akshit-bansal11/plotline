"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

import { Timestamp, addDoc, collection, serverTimestamp, query, orderBy, limit, onSnapshot, updateDoc, doc, getDocs, where, deleteDoc } from "firebase/firestore";
import { Plus, Gamepad2, Monitor, Smartphone, Disc, HardDrive, Hexagon, Tablet, Laptop, Terminal, Loader2, Search, ChevronDown, X, CheckCircle } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { cn, entryMediaTypeLabels, entryStatusLabels } from "@/lib/utils";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/auth-context";
import { NewListModal } from "@/components/lists/new-list-modal";
import { DescriptionTextarea } from "@/components/ui/description-textarea";
import { sanitizeImportedDescription } from "@/lib/validation";
import { InfographicToast } from "@/components/ui/infographic-toast";
import { updateBidirectionalRelations, RELATION_OPTIONS, RelationType } from "@/lib/relations";
import { useData, EntryDoc } from "@/context/data-context";

export type EntryMediaType = "movie" | "series" | "anime" | "manga" | "game";
export type EntryStatus = "watching" | "completed" | "plan_to_watch" | "on_hold" | "dropped" | "unspecified" | "main_story_completed" | "fully_completed" | "backlogged" | "bored" | "own" | "wishlist" | "not_committed" | "committed";

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
  relations?: { targetId: string; type: string; createdAtMs: number; inferred?: boolean }[];
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

const STANDARD_STATUS_OPTIONS: EntryStatus[] = ["watching", "completed", "plan_to_watch", "on_hold", "dropped"];
const GAME_STATUS_OPTIONS: EntryStatus[] = [
  "main_story_completed",
  "fully_completed",
  "backlogged",
  "bored",
  "own",
  "wishlist",
  "not_committed",
  "committed",
  "dropped"
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
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return { date, millis: date.getTime() };
};

function ExpandableText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 150;

  return (
    <div className="mt-1">
      <div className={cn("text-xs text-neutral-400", !expanded && isLong && "line-clamp-2")}>
        {text}
      </div>
      {isLong && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-neutral-500 hover:text-neutral-300"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

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
  const cacheRef = useRef<Map<string, { timestamp: number; results: SearchResult[]; errors: string[] }>>(new Map());

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
  const [duplicateToast, setDuplicateToast] = useState<{ id: number; message: string } | null>(null);

  const [originalRelations, setOriginalRelations] = useState<{ targetId: string; type: string; createdAtMs: number }[]>([]);
  const [relations, setRelations] = useState<EditableRelation[]>([]);
  const [isRelationSearchOpen, setIsRelationSearchOpen] = useState(false);
  const [relationSearchQuery, setRelationSearchQuery] = useState("");
  const [selectedRelationDoc, setSelectedRelationDoc] = useState<EntryDoc | null>(null);
  const [selectedRelationType, setSelectedRelationType] = useState<RelationType>("Sequel");

  const [lists, setLists] = useState<{ id: string; name: string; type: ListMediaType; types: ListMediaType[] }[]>([]);

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

  /* Tabs removed */

  const initializedRef = useRef<string | number | null>(null);
  const fetchedListIdsForEntryRef = useRef<string | number | null>(null);

  useEffect(() => {
    if (!uid || !isOpen) {
      setLists([]);
      return;
    }

    const q = query(collection(db, "users", uid, "lists"), orderBy("createdAt", "desc"), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLists(snapshot.docs.map((doc) => {
        const data = doc.data() as { name?: string; type?: string; types?: string[] };
        const singleType = (data.type === "movie" || data.type === "series" || data.type === "anime" || data.type === "manga" || data.type === "game"
          ? data.type
          : "movie") as ListMediaType;
        const types = (Array.isArray(data.types)
          ? data.types.filter((t): t is ListMediaType => ["movie", "series", "anime", "manga", "game"].includes(t))
          : [singleType]) as ListMediaType[];
        return {
          id: doc.id,
          name: data.name || "Untitled List",
          type: singleType,
          types
        };
      }));
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
      const res = await fetch(`/api/search?q=${encodeURIComponent(queryValue.trim())}&type=${typeValue}`, {
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(res.status === 429 ? "Search is rate limited. Try again shortly." : "Search failed.");
      }
      const data = (await res.json()) as SearchResponse;
      setSearchResults(data.results || []);
      if (data.errors && data.errors.length > 0) {
        setSearchError(data.errors[0]);
      }

      cacheRef.current.set(key, {
        timestamp: now,
        results: data.results || [],
        errors: data.errors || []
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

  const relatedTargetIdSet = useMemo(() => new Set(relations.map((relation) => relation.targetId)), [relations]);

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

      results.forEach(id => {
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
  }, [uid, isOpen, isEditing, normalizedInitial?.id, lists]);

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
          : typeof normalizedInitial.rating === "number"
            ? normalizedInitial.rating
            : null;
      if (typeof initialUserRating === "number" && initialUserRating >= 1 && initialUserRating <= 10) {
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
      if (typeof initialImdbRating === "number" && initialImdbRating >= 0 && initialImdbRating <= 10) {
        setImdbRating(String(initialImdbRating));
      } else {
        setImdbRating("");
      }

      setReleaseYear(normalizedInitial.releaseYear || normalizedInitial.year || "");
      setLengthMinutes(normalizedInitial.lengthMinutes ? String(normalizedInitial.lengthMinutes) : "");
      setEpisodeCount(normalizedInitial.episodeCount ? String(normalizedInitial.episodeCount) : "");
      setChapterCount(normalizedInitial.chapterCount ? String(normalizedInitial.chapterCount) : "");

      setPlayTime(normalizedInitial.playTime ? String(normalizedInitial.playTime) : "");
      setAchievements(normalizedInitial.achievements ? String(normalizedInitial.achievements) : "");
      setTotalAchievements(normalizedInitial.totalAchievements ? String(normalizedInitial.totalAchievements) : "");
      const isPredefined = PLATFORM_OPTIONS.some(p => p.id === normalizedInitial.platform);
      if (normalizedInitial.platform && !isPredefined) {
        setIsCustomPlatform(true);
      } else {
        setIsCustomPlatform(false);
      }
      setPlatform(normalizedInitial.platform || "");

      setTags(Array.isArray(normalizedInitial.genresThemes) ? normalizedInitial.genresThemes.slice(0, 10) : []);
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
    if (!Number.isInteger(value) || value < 1 || value > 10) return "Rating must be between 1 and 10.";
    return null;
  }, [userRating]);

  const imdbRatingError = useMemo(() => {
    const raw = imdbRating.trim();
    if (!raw) return null;
    if (!/^\d+(\.\d{1,2})?$/.test(raw)) return "IMDb rating must be a number from 0 to 10.";
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || value > 10) return "IMDb rating must be between 0 and 10.";
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
    if (mediaType === "movie" || (mediaType === "anime" && isMovie)) return { key: "lengthMinutes" as const, label: "Length (minutes)", value: lengthMinutes };
    if (mediaType === "series" || mediaType === "anime") return { key: "episodeCount" as const, label: "Number of episodes", value: episodeCount };
    if (mediaType === "manga") return { key: "chapterCount" as const, label: "Number of chapters", value: chapterCount };
    // Games handled separately now
    return null;
  }, [chapterCount, episodeCount, lengthMinutes, mediaType, isMovie]);

  const numericFieldError = useMemo(() => {
    if (!numericField) return null;
    const raw = numericField.value.trim();
    if (!raw) return null;
    if (!/^\d+$/.test(raw)) return `${numericField.label} must be a positive integer.`;
    const value = Number(raw);
    if (!Number.isInteger(value) || value <= 0) return `${numericField.label} must be a positive integer.`;
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
      mediaType === "series" || mediaType === "anime" ? (episodeCount.trim() ? Number(episodeCount.trim()) : null) : null;
    const chapterCountValue = mediaType === "manga" ? (chapterCount.trim() ? Number(chapterCount.trim()) : null) : null;

    // Game fields
    const playTimeValue = mediaType === "game" ? (playTime.trim() ? Number(playTime.trim()) : null) : null;
    const achievementsValue = mediaType === "game" ? (achievements.trim() ? Number(achievements.trim()) : null) : null;
    const totalAchievementsValue = mediaType === "game" ? (totalAchievements.trim() ? Number(totalAchievements.trim()) : null) : null;
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
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
        if (parsed.millis > endOfToday) {
          setError("Completion date cannot be in the future.");
          return;
        }
        completedAt = Timestamp.fromDate(parsed.date);
      }
    }

    // Validate lists
    if (selectedListIds.size > 0) {
      for (const id of selectedListIds) {
        const list = lists.find(l => l.id === id);
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
      const relationPayload = relations.reduce<{ targetId: string; type: string; createdAtMs: number }[]>(
        (acc, relation) => {
          if (!relation.targetId || !relation.type) return acc;
          if (acc.some((existing) => existing.targetId === relation.targetId)) return acc;
          acc.push({
            targetId: relation.targetId,
            type: relation.type,
            createdAtMs: Date.now(),
          });
          return acc;
        },
        [],
      );

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
        listIds: Array.from(selectedListIds), // Save list relationships in entry
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
      const addedIds = Array.from(selectedListIds).filter(id => !initialListIds.has(id));
      const removedIds = Array.from(initialListIds).filter(id => !selectedListIds.has(id));
      const commonIds = Array.from(selectedListIds).filter(id => initialListIds.has(id));

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
          })
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
              limit(1)
            );
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
              await deleteDoc(doc(db, "users", uid, "lists", listId, "items", snapshot.docs[0].id));
              await updateDoc(doc(db, "users", uid, "lists", listId), {
                updatedAt: serverTimestamp(),
              });
            }
          })()
        );
      }

      // Update existing items in lists (commonIds) to reflect title/image changes
      for (const listId of commonIds) {
        promises.push(
          (async () => {
            const q = query(
              collection(db, "users", uid, "lists", listId, "items"),
              where("externalId", "==", finalEntryId),
              limit(1)
            );
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
              await updateDoc(doc(db, "users", uid, "lists", listId, "items", snapshot.docs[0].id), {
                title: trimmedTitle,
                mediaType: listMediaType,
                image: image,
                year: releaseYearValue,
              });
            }
          })()
        );
      }

      await Promise.all(promises);

      const relationsToSave = relationPayload.map((relation) => ({ targetId: relation.targetId, type: relation.type }));
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? "Edit entry" : "Log entry"} className="max-w-5xl bg-neutral-900/60">
      <div className="w-full">
        {activeTab === "search" ? (
          <div className="flex flex-col h-[600px]">
            <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <input
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    runSearch(e.target.value, searchType);
                  }}
                  placeholder="Search for movies, series, anime..."
                  className="w-full rounded-xl bg-neutral-800/50 border border-neutral-100/5 py-2 pl-9 pr-4 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-neutral-100/20 focus:ring-1 focus:ring-neutral-100/20 transition-all"
                  autoFocus
                />
              </div>
              <select
                value={searchType}
                onChange={(e) => {
                  const next = e.target.value as EntryMediaType;
                  setSearchType(next);
                  runSearch(searchQuery, next);
                }}
                className="rounded-xl bg-neutral-800/50 border border-neutral-100/5 py-2 px-3 text-sm text-neutral-100 focus:outline-none focus:border-neutral-100/20 transition-all"
              >
                {(["movie", "series", "anime", "manga", "game"] as EntryMediaType[]).map((t) => (
                  <option key={t} value={t}>{mediaTypeLabels[t]}</option>
                ))}
              </select>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-2 scroll-smooth">
              {isSearching ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-neutral-500" />
                </div>
              ) : searchResults.length > 0 ? (
                searchResults.map((result) => {
                  const isDuplicate = entries.some((e) => {
                    if (String(e.externalId) === String(result.id)) return true;
                    if (e.mediaType !== result.type) return false;
                    const eName = e.title.trim().toLowerCase();
                    const rName = result.title.trim().toLowerCase();
                    if (eName !== rName) return false;
                    const eYear = e.releaseYear || e.year || "";
                    const rYear = result.year || "";
                    if (eYear && rYear && eYear !== rYear) return false;
                    return true;
                  });

                  return (
                    <div
                      key={result.id}
                      onClick={() => !isDuplicate && handleSelectResult(result)}
                      className={cn(
                        "flex w-full gap-3 rounded-xl border p-2 text-left transition-all relative overflow-hidden",
                        isDuplicate
                          ? "opacity-50 cursor-not-allowed bg-neutral-900 border-white/5"
                          : "border-transparent hover:bg-white/5 hover:border-white/5 group cursor-pointer"
                      )}
                    >
                      {isDuplicate && (
                        <div className="absolute inset-0 bg-neutral-950/40 backdrop-blur-[1px] z-10 flex items-center justify-center">
                          <CheckCircle className="text-emerald-500 h-8 w-8 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        </div>
                      )}
                      <div className="h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-neutral-800">
                        {result.image ? (
                          <Image src={result.image} alt={result.title} width={56} height={80} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-neutral-700">
                            <Search size={16} />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col justify-center min-w-0">
                        <div className="truncate font-medium text-neutral-200 group-hover:text-white">{result.title}</div>
                        <div className="text-xs text-neutral-500">
                          {result.year ? `${result.year} • ` : ""}{mediaTypeLabels[result.type]}
                        </div>
                        {result.overview && <ExpandableText text={result.overview} />}
                      </div>
                    </div>
                  );
                })
              ) : searchQuery ? (
                <div className="text-center text-sm text-neutral-500 py-10">
                  {searchError || "No results found."}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-neutral-500 gap-2">
                  <Search className="h-8 w-8 opacity-20" />
                  <div className="text-sm">Type to search online databases</div>
                </div>
              )}
            </div>

            <div className="pt-4 mt-auto border-t border-white/5">
              <button
                type="button"
                onClick={() => setActiveTab("manual")}
                className="w-full rounded-xl border border-white/10 bg-neutral-800/40 py-3 text-sm font-medium text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
              >
                Enter manually
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex max-h-[600px] flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto pr-1 scroll-smooth">
              {isFetchingMetadata && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs animate-pulse">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Fetching detailed metadata...
                </div>
              )}
              <div className="space-y-2">
                <div className="text-xs font-medium text-neutral-400">Title</div>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Dune: Part Two"
                  className="w-full rounded-xl bg-neutral-800/50 border border-neutral-100/5 py-3 px-4 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-neutral-100/20 focus:ring-1 focus:ring-neutral-100/20 transition-all"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-xs font-medium text-neutral-400">Type</div>
                  <select
                    value={mediaType}
                    onChange={(e) => setMediaType(e.target.value as EntryMediaType)}
                    className="w-full rounded-xl bg-neutral-800/50 border border-neutral-100/5 py-3 px-4 text-neutral-100 focus:outline-none focus:border-neutral-100/20 focus:ring-1 focus:ring-neutral-100/20 transition-all"
                  >
                    {(["movie", "series", "anime", "manga", "game"] as EntryMediaType[]).map((value) => (
                      <option key={value} value={value}>
                        {mediaTypeLabels[value]}
                      </option>
                    ))}
                  </select>
                  {mediaType === "anime" && (
                    <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={isMovie}
                        onChange={(e) => setIsMovie(e.target.checked)}
                        className="h-3 w-3 rounded border border-neutral-100/10 bg-neutral-800/50"
                      />
                      Is a Movie?
                    </label>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-medium text-neutral-400">Status</div>
                  <div className="relative">
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">
                      <ChevronDown size={14} />
                    </div>
                    <select
                      value={status}
                      onChange={(e) => {
                        const next = e.target.value as EntryStatus;
                        setStatus(next);
                        if ((next === "completed" || next === "main_story_completed" || next === "fully_completed") && !completionDate && !completionUnknown) {
                          setCompletionDate(todayISODate());
                        }
                      }}
                      className="w-full appearance-none rounded-xl bg-neutral-800/50 border border-neutral-100/5 py-3 pl-4 pr-10 text-neutral-100 focus:outline-none focus:border-neutral-100/20 focus:ring-1 focus:ring-neutral-100/20 transition-all"
                    >
                      <option value="unspecified">Select status...</option>
                      {(mediaType === "game" ? GAME_STATUS_OPTIONS : STANDARD_STATUS_OPTIONS).map((s) => (
                        <option key={s} value={s}>
                          {statusLabels[s]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium text-neutral-400">Add to Lists</div>
                  <button
                    type="button"
                    onClick={() => setIsNewListOpen(true)}
                    className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
                  >
                    <Plus size={12} />
                    New List
                  </button>
                </div>
                <div className="max-h-32 overflow-y-auto rounded-xl bg-neutral-800/30 border border-neutral-100/5 p-2 space-y-1">
                  {availableLists.length > 0 ? (
                    availableLists.map((list) => (
                      <label key={list.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedListIds.has(list.id)}
                          onChange={(e) => {
                            const next = new Set(selectedListIds);
                            if (e.target.checked) next.add(list.id);
                            else next.delete(list.id);
                            setSelectedListIds(next);
                          }}
                          className="h-4 w-4 rounded border border-neutral-100/10 bg-neutral-800/50"
                        />
                        <span className="text-sm text-neutral-200">{list.name}</span>
                      </label>
                    ))
                  ) : (
                    <div className="text-xs text-neutral-500 p-2 text-center">No compatible lists found.</div>
                  )}
                </div>
              </div>

              {numericField ? (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-neutral-400">{numericField.label}</div>
                  <input
                    type="number"
                    value={numericField.value}
                    onChange={(e) => {
                      const next = e.target.value;
                      if (numericField.key === "lengthMinutes") setLengthMinutes(next);
                      if (numericField.key === "episodeCount") setEpisodeCount(next);
                      if (numericField.key === "chapterCount") setChapterCount(next);
                    }}
                    placeholder="Optional"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    className="w-full rounded-xl bg-neutral-800/50 border border-neutral-100/5 py-3 px-4 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-neutral-100/20 focus:ring-1 focus:ring-neutral-100/20 transition-all"
                  />
                  {numericFieldError ? <div className="text-xs text-red-400">{numericFieldError}</div> : null}
                </div>
              ) : null}

              {/* Game Fields */}
              {mediaType === "game" && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-neutral-400">Play Time (hours)</div>
                    <input
                      type="number"
                      value={playTime}
                      onChange={(e) => setPlayTime(e.target.value)}
                      placeholder="Optional"
                      className="w-full rounded-xl bg-neutral-800/50 border border-neutral-100/5 py-3 px-4 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-neutral-100/20 focus:ring-1 focus:ring-neutral-100/20 transition-all"
                    />
                  </div>
                  <div className="space-y-2 col-span-1 sm:col-span-2">
                    <div className="text-xs font-medium text-neutral-400">Platform</div>
                    {!isCustomPlatform ? (
                      <div className="space-y-3">
                        <div className="max-h-48 overflow-y-auto pr-1 grid grid-cols-2 sm:grid-cols-3 gap-2 custom-scrollbar">
                          {PLATFORM_OPTIONS.map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setPlatform(opt.id)}
                              className={cn(
                                "flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all",
                                platform === opt.id
                                  ? "bg-neutral-100 border-neutral-100 text-neutral-950"
                                  : "bg-neutral-800/50 border-white/5 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
                              )}
                            >
                              <opt.icon size={14} />
                              <span className="truncate">{opt.label}</span>
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setIsCustomPlatform(true);
                            setPlatform("");
                          }}
                          className="flex items-center gap-2 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
                        >
                          <Plus size={12} />
                          <span>Other platform...</span>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <input
                            value={platform}
                            onChange={(e) => setPlatform(e.target.value)}
                            placeholder="e.g. Ouya"
                            className="w-full rounded-xl bg-neutral-800/50 border border-neutral-100/5 py-3 px-4 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-neutral-100/20 focus:ring-1 focus:ring-neutral-100/20 transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setIsCustomPlatform(false);
                              setPlatform("");
                            }}
                            className="px-4 rounded-xl border border-white/10 bg-neutral-800/50 text-xs font-semibold text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-neutral-400">Achievements</div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={achievements}
                        onChange={(e) => setAchievements(e.target.value)}
                        placeholder="Unlocked"
                        className="w-full rounded-xl bg-neutral-800/50 border border-neutral-100/5 py-3 px-4 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-neutral-100/20 focus:ring-1 focus:ring-neutral-100/20 transition-all"
                      />
                      <span className="text-neutral-500">/</span>
                      <input
                        type="number"
                        value={totalAchievements}
                        onChange={(e) => setTotalAchievements(e.target.value)}
                        placeholder="Total"
                        className="w-full rounded-xl bg-neutral-800/50 border border-neutral-100/5 py-3 px-4 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-neutral-100/20 focus:ring-1 focus:ring-neutral-100/20 transition-all"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="text-xs font-medium text-neutral-400">Release year</div>
                <input
                  value={releaseYear}
                  onChange={(e) => setReleaseYear(e.target.value)}
                  placeholder="e.g. 2024"
                  inputMode="numeric"
                  maxLength={4}
                  className="w-full rounded-xl bg-neutral-800/50 border border-neutral-100/5 py-3 px-4 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-neutral-100/20 focus:ring-1 focus:ring-neutral-100/20 transition-all"
                />
                {releaseYearError ? <div className="text-xs text-red-400">{releaseYearError}</div> : null}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium text-neutral-400">Your rating</div>
                    <div className="text-xs text-neutral-500">1–10</div>
                  </div>
                  <input
                    type="number"
                    value={userRating}
                    onChange={(e) => setUserRating(e.target.value)}
                    placeholder="Optional"
                    inputMode="numeric"
                    min={1}
                    max={10}
                    step={1}
                    className="w-full rounded-xl bg-neutral-800/50 border border-neutral-100/5 py-3 px-4 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-neutral-100/20 focus:ring-1 focus:ring-neutral-100/20 transition-all"
                  />
                  {userRatingError ? <div className="text-xs text-red-400">{userRatingError}</div> : null}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium text-neutral-400">
                      {mediaType === "game" ? "IGDB Rating" : mediaType === "anime" || mediaType === "manga" ? "MAL Rating" : "IMDb Rating"}
                    </div>
                    <div className="text-xs text-neutral-500">0–10</div>
                  </div>
                  <input
                    type="number"
                    value={imdbRating}
                    onChange={(e) => setImdbRating(e.target.value)}
                    placeholder="Optional"
                    inputMode="decimal"
                    min={0}
                    max={10}
                    step={0.1}
                    className="w-full rounded-xl bg-neutral-800/50 border border-neutral-100/5 py-3 px-4 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-neutral-100/20 focus:ring-1 focus:ring-neutral-100/20 transition-all"
                  />
                  {imdbRatingError ? <div className="text-xs text-red-400">{imdbRatingError}</div> : null}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs font-medium text-neutral-400">Date of completion</div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setCompletionDate(todayISODate())}
                      disabled={(status !== "completed" && status !== "main_story_completed" && status !== "fully_completed") || completionUnknown || isSaving}
                      className={cn(
                        "rounded-full border border-neutral-100/10 bg-neutral-800/40 px-3 py-1 text-xs text-neutral-200 transition-colors hover:bg-neutral-800 hover:text-neutral-100",
                        (status !== "completed" && status !== "main_story_completed" && status !== "fully_completed") || completionUnknown || isSaving ? "cursor-not-allowed opacity-70" : ""
                      )}
                    >
                      Today
                    </button>
                    <label className="flex items-center gap-2 text-xs text-neutral-300">
                      <input
                        type="checkbox"
                        checked={completionUnknown}
                        onChange={(e) => {
                          const next = e.target.checked;
                          setCompletionUnknown(next);
                          if (next) setCompletionDate("");
                          if (!next && (status === "completed" || status === "main_story_completed" || status === "fully_completed") && !completionDate) setCompletionDate(todayISODate());
                        }}
                        disabled={(status !== "completed" && status !== "main_story_completed" && status !== "fully_completed") || isSaving}
                        className="h-4 w-4 rounded border border-neutral-100/10 bg-neutral-800/50"
                      />
                      Unknown
                    </label>
                  </div>
                </div>
                <input
                  type="date"
                  value={completionDate}
                  onChange={(e) => setCompletionDate(e.target.value)}
                  disabled={(status !== "completed" && status !== "main_story_completed" && status !== "fully_completed") || completionUnknown || isSaving}
                  className={cn(
                    "w-full rounded-xl bg-neutral-800/50 border border-neutral-100/5 py-3 px-4 text-neutral-100 focus:outline-none focus:border-neutral-100/20 focus:ring-1 focus:ring-neutral-100/20 transition-all",
                    (status !== "completed" && status !== "main_story_completed" && status !== "fully_completed") || completionUnknown || isSaving ? "cursor-not-allowed opacity-70" : ""
                  )}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium text-neutral-400">Genres / themes</div>
                  <div className="text-xs text-neutral-500">{tags.length}/10 tags</div>
                </div>
                <div className="flex flex-wrap gap-2 mb-2">
                  {tags.map((tag, index) => (
                    <div
                      key={`${tag}-${index}`}
                      className="flex items-center gap-1 rounded-full bg-neutral-800 px-3 py-1 text-xs text-neutral-200 border border-neutral-100/10"
                    >
                      <span>{tag}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const newTags = [...tags];
                          newTags.splice(index, 1);
                          setTags(newTags);
                        }}
                        className="ml-1 text-neutral-500 hover:text-neutral-100 transition-colors"
                        aria-label={`Remove ${tag}`}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="h-3 w-3"
                        >
                          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
                <input
                  value={tagInput}
                  onChange={(e) => {
                    setError(null);
                    const val = e.target.value;
                    const cleanVal = val.replace(/[^A-Za-z_,\s]/g, "");

                    if (cleanVal.includes(",")) {
                      if (tags.length >= 10) {
                        setError("Maximum of 10 tags allowed.");
                        return;
                      }
                      const parts = cleanVal.split(",");
                      const newTags = [...tags];
                      let errorMsg = null;

                      for (const part of parts) {
                        const trimmed = part.trim();
                        if (!trimmed) continue;

                        if (newTags.includes(trimmed)) {
                          errorMsg = `Duplicate tag: "${trimmed}"`;
                          continue;
                        }

                        if (newTags.length >= 10) {
                          errorMsg = "Maximum of 10 tags allowed.";
                          break;
                        }

                        newTags.push(trimmed);
                      }

                      if (errorMsg) setError(errorMsg);
                      setTags(newTags);
                      const lastCommaIndex = cleanVal.lastIndexOf(",");
                      const remainder = cleanVal.substring(lastCommaIndex + 1);
                      setTagInput(remainder);
                    } else {
                      setTagInput(cleanVal);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Backspace" && !tagInput && tags.length > 0) {
                      const newTags = [...tags];
                      newTags.pop();
                      setTags(newTags);
                    }
                  }}
                  disabled={tags.length >= 10}
                  placeholder={tags.length >= 10 ? "Limit reached" : "e.g. dark_fantasy, coming_of_age"}
                  className={cn(
                    "w-full rounded-xl bg-neutral-800/50 border border-neutral-100/5 py-3 px-4 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-neutral-100/20 focus:ring-1 focus:ring-neutral-100/20 transition-all",
                    tags.length >= 10 ? "opacity-50 cursor-not-allowed" : ""
                  )}
                />
                <div className="space-y-1 text-xs text-neutral-500">
                  <div>Type a comma to add a tag. Allowed: letters (A–Z), underscores, spaces.</div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-300">Description</label>
                <DescriptionTextarea
                  value={description}
                  onValueChange={setDescription}
                  rows={4}
                  placeholder="What did you think?"
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-white/5 mt-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-neutral-300">Related Entries</label>
                </div>
                <div className="space-y-3">
                  {relations.map((rel, idx) => (
                    <div key={`${rel.targetId}-${rel.type}`} className="flex items-center gap-3 bg-neutral-800/50 p-3 rounded-xl border border-white/5">
                      {rel.image ? (
                        <div className="w-8 h-12 relative rounded overflow-hidden shrink-0 bg-neutral-800 hidden sm:block">
                          <Image src={rel.image} alt="" fill className="object-cover" />
                        </div>
                      ) : (
                        <div className="w-8 h-12 rounded bg-neutral-800 shrink-0 hidden sm:block" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-neutral-200 truncate">{rel.title}</div>
                        <div className="text-[10px] text-neutral-500">{rel.type}</div>
                      </div>
                      <button type="button" onClick={() => setRelations(prev => prev.filter((_, i) => i !== idx))} className="text-neutral-500 hover:text-red-400 p-2">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  {!isRelationSearchOpen ? (
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setIsRelationSearchOpen(true);
                      }}
                      className="flex items-center gap-2 text-xs font-medium text-neutral-400 hover:text-neutral-200 transition-colors"
                    >
                      <Plus className="w-4 h-4" /> Add Related Entry
                    </button>
                  ) : (
                    <div className="bg-neutral-800/80 p-3 rounded-xl border border-white/10 space-y-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                        <input
                          value={relationSearchQuery}
                          onChange={e => {
                            setError(null);
                            setRelationSearchQuery(e.target.value);
                            setSelectedRelationDoc(null);
                          }}
                          placeholder="Search your library..."
                          className="w-full bg-neutral-900/50 border border-white/5 rounded-lg py-2 pl-9 pr-3 text-sm text-neutral-200 focus:outline-none focus:border-white/20"
                        />
                        {relationSearchQuery && !selectedRelationDoc && (
                          <div className="absolute top-full left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-neutral-900 border border-white/10 rounded-lg shadow-xl z-50">
                            {entries.filter((entry) => {
                              const entryId = String(entry.id);
                              return (
                                entry.title.toLowerCase().includes(relationSearchQuery.toLowerCase()) &&
                                entryId !== String(normalizedInitial?.id || "new") &&
                                !relatedTargetIdSet.has(entryId)
                              );
                            }).map(e => (
                              <button
                                type="button"
                                key={e.id}
                                onClick={() => { setSelectedRelationDoc(e); setRelationSearchQuery(e.title); }}
                                className="w-full text-left px-3 py-2 text-xs text-neutral-300 hover:bg-white/10 truncate"
                              >
                                {e.title}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {selectedRelationDoc && (
                        <div className="flex gap-2">
                          <select
                            value={selectedRelationType}
                            onChange={e => setSelectedRelationType(e.target.value as RelationType)}
                            className="flex-1 bg-neutral-900/50 border border-white/5 rounded-lg py-2 px-3 text-sm text-neutral-200 focus:outline-none focus:border-white/20"
                          >
                            {RELATION_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                          <button
                            type="button"
                            onClick={() => {
                              const targetId = String(selectedRelationDoc.id);
                              if (targetId === String(normalizedInitial?.id || "new")) {
                                setError("You cannot relate an entry to itself.");
                                return;
                              }
                              if (relations.some((relation) => relation.targetId === targetId)) {
                                setError("This entry is already related. Remove it first to change the relation type.");
                                return;
                              }
                              setError(null);
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
                              setIsRelationSearchOpen(false);
                              setRelationSearchQuery("");
                              setSelectedRelationDoc(null);
                            }}
                            className="bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-4 rounded-lg transition-colors"
                          >
                            Add
                          </button>
                        </div>
                      )}
                      <button type="button" onClick={() => { setIsRelationSearchOpen(false); setRelationSearchQuery(""); setSelectedRelationDoc(null); }} className="w-full text-xs text-neutral-500 hover:text-neutral-300 py-1 text-center">Cancel</button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-4">
              {error && <div className="text-sm text-red-400">{error}</div>}
              {info && <div className="text-sm text-emerald-300">{info}</div>}

              <button
                type="submit"
                disabled={isSaving}
                className={cn(
                  "w-full rounded-xl bg-neutral-100/90 backdrop-blur-sm py-3 font-semibold text-neutral-950 transition-all hover:bg-neutral-100 hover:shadow-[0_0_20px_rgba(245,245,245,0.1)] active:scale-[0.98]",
                  isSaving ? "cursor-not-allowed opacity-70" : ""
                )}
              >
                {isSaving ? "Saving..." : "Save entry"}
              </button>
            </div>
          </form>
        )}
      </div>
      <NewListModal
        isOpen={isNewListOpen}
        onClose={() => setIsNewListOpen(false)}
        defaultType={listDefaultType}
        onCreated={(list) => {
          const next = new Set(selectedListIds);
          next.add(list.id);
          setSelectedListIds(next);
          setInfo("List created and selected.");
        }}
      />
      <InfographicToast
        isOpen={Boolean(duplicateToast)}
        title="Duplicate Detected"
        message={duplicateToast?.message || ""}
        onClose={() => setDuplicateToast(null)}
      />
    </Modal>
  );
}
