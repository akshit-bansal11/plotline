"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { motion } from "motion/react";
import { Timestamp, addDoc, collection, serverTimestamp, query, orderBy, limit, onSnapshot, updateDoc, doc, getDocs, where, deleteDoc } from "firebase/firestore";
import { Search, Plus, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { cn, entryMediaTypeLabels, entryStatusLabels } from "@/lib/utils";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/auth-context";
import { NewListModal } from "@/components/lists/new-list-modal";

export type EntryMediaType = "movie" | "series" | "anime" | "anime_movie" | "manga" | "game";
export type EntryStatus = "watching" | "completed" | "plan_to_watch" | "on_hold" | "dropped" | "unspecified";

export type LoggableMedia = {
  id: string | number;
  title: string;
  image: string | null;
  year?: string;
  releaseYear?: string;
  type: "movie" | "series" | "anime" | "anime_movie" | "manga" | "game";
  description?: string;
  userRating?: number | null;
  imdbRating?: number | null;
  rating?: number | null;
  lengthMinutes?: number | null;
  episodeCount?: number | null;
  chapterCount?: number | null;
  genresThemes?: string[];
  status?: EntryStatus;
  completedAt?: number | null;
  completionDateUnknown?: boolean;
};

type ListMediaType = "movie" | "series" | "anime" | "manga" | "game";

const listTypeLabels: Record<ListMediaType, string> = {
  movie: "Movie",
  series: "Series",
  anime: "Anime",
  manga: "Manga",
  game: "Game",
};

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

const statusLabels: Record<EntryStatus, string> = entryStatusLabels;
const mediaTypeLabels: Record<EntryMediaType, string> = entryMediaTypeLabels;

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
  const [status, setStatus] = useState<EntryStatus>("unspecified");
  const [userRating, setUserRating] = useState<string>("");
  const [imdbRating, setImdbRating] = useState<string>("");
  const [releaseYear, setReleaseYear] = useState<string>("");
  const [lengthMinutes, setLengthMinutes] = useState<string>("");
  const [episodeCount, setEpisodeCount] = useState<string>("");
  const [chapterCount, setChapterCount] = useState<string>("");
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

  const [lists, setLists] = useState<{ id: string; name: string; type: ListMediaType; types: ListMediaType[] }[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>("");
  const [isNewListOpen, setIsNewListOpen] = useState(false);
  const [currentListId, setCurrentListId] = useState<string | null>(null);
  const [currentListName, setCurrentListName] = useState("");
  const [currentListItemId, setCurrentListItemId] = useState<string | null>(null);
  const [showListChange, setShowListChange] = useState(false);

  const uid = user?.uid || null;

  const manualTabRef = useRef<HTMLButtonElement>(null);
  const searchTabRef = useRef<HTMLButtonElement>(null);
  const [indicatorX, setIndicatorX] = useState(0);
  const [indicatorWidth, setIndicatorWidth] = useState(0);

  const initializedRef = useRef<string | number | null>(null);

  useEffect(() => {
    const activeRef = activeTab === "manual" ? manualTabRef : searchTabRef;
    if (activeRef.current) {
      setIndicatorX(activeRef.current.offsetLeft);
      setIndicatorWidth(activeRef.current.offsetWidth);
    }
  }, [activeTab]);

  useEffect(() => {
    if (!uid || !isOpen) {
      setLists([]);
      return;
    }

    const q = query(collection(db, "users", uid, "lists"), orderBy("updatedAt", "desc"), limit(50));
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
    setDescription(result.overview || "");
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
          if (data.description) setDescription(data.description);
          if (data.year) setReleaseYear(data.year);
          if (data.rating) setImdbRating(data.rating.toFixed(1));
          if (data.lengthMinutes) setLengthMinutes(String(data.lengthMinutes));
          if (data.episodeCount) setEpisodeCount(String(data.episodeCount));
          if (data.chapterCount) setChapterCount(String(data.chapterCount));
          if (data.genresThemes && Array.isArray(data.genresThemes)) {
            setTags(data.genresThemes.slice(0, 10));
          }
          if (data.image) setImage(data.image);
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
          ? "anime_movie"
          : initialMedia.type === "manga"
            ? "manga"
            : initialMedia.type === "game"
              ? "game"
              : initialMedia.type === "series"
                ? "series"
                : "movie";
    return { ...initialMedia, inferredType };
  }, [initialMedia]);

  const listDefaultType = useMemo<"movie" | "series" | "anime" | "manga" | "game" | null>(() => {
    if (!mediaType) return null;
    return mediaType === "anime_movie" ? "anime" : mediaType;
  }, [mediaType]);

  const listMediaType = useMemo<ListMediaType>(() => {
    return mediaType === "anime_movie" ? "anime" : mediaType;
  }, [mediaType]);

  const availableLists = useMemo(() => {
    let result = lists;
    if (showListChange && currentListId) {
      result = result.filter((list) => list.id !== currentListId);
    }
    return result.filter((list) => list.types.includes(listMediaType));
  }, [lists, showListChange, currentListId, listMediaType]);

  useEffect(() => {
    if (!uid || !isOpen || !isEditing || !normalizedInitial?.id || lists.length === 0) {
      setCurrentListId(null);
      setCurrentListName("");
      setCurrentListItemId(null);
      return;
    }
    let cancelled = false;
    const entryId = String(normalizedInitial.id);
    const findCurrentList = async () => {
      for (const list of lists) {
        const itemsQuery = query(
          collection(db, "users", uid, "lists", list.id, "items"),
          where("externalId", "==", entryId),
          limit(1),
        );
        const snapshot = await getDocs(itemsQuery);
        if (!snapshot.empty) {
          if (cancelled) return;
          const itemDoc = snapshot.docs[0];
          setCurrentListId(list.id);
          setCurrentListName(list.name);
          setCurrentListItemId(itemDoc.id);
          if (!showListChange) {
            setSelectedListId(list.id);
          }
          return;
        }
      }
      if (!cancelled) {
        setCurrentListId(null);
        setCurrentListName("");
        setCurrentListItemId(null);
        if (!showListChange) setSelectedListId("");
      }
    };
    findCurrentList();
    return () => {
      cancelled = true;
    };
  }, [uid, isOpen, isEditing, normalizedInitial?.id, lists, showListChange]);

  useEffect(() => {
    if (!isOpen) {
      initializedRef.current = null;
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

      setActiveTab("manual");
      setTitle(normalizedInitial.title);
      setMediaType(normalizedInitial.inferredType);
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
      setSelectedListId("");
      setCurrentListId(null);
      setCurrentListName("");
      setCurrentListItemId(null);
      setShowListChange(false);
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
      setStatus("unspecified");
      setUserRating("");
      setImdbRating("");
      setReleaseYear("");
      setLengthMinutes("");
      setEpisodeCount("");
      setChapterCount("");
      setTags([]);
      setTagInput("");
      setDescription("");
      setCompletionDate("");
      setCompletionUnknown(false);
      setImage(null);
      setExternalId(null);
      setSelectedListId("");
    }
  }, [isOpen, normalizedInitial]);

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
    if (mediaType === "movie" || mediaType === "anime_movie") return { key: "lengthMinutes" as const, label: "Length (minutes)", value: lengthMinutes };
    if (mediaType === "series" || mediaType === "anime") return { key: "episodeCount" as const, label: "Number of episodes", value: episodeCount };
    if (mediaType === "manga") return { key: "chapterCount" as const, label: "Number of chapters", value: chapterCount };
    return null;
  }, [chapterCount, episodeCount, lengthMinutes, mediaType]);

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
      mediaType === "movie" || mediaType === "anime_movie"
        ? lengthMinutes.trim()
          ? Number(lengthMinutes.trim())
          : null
        : null;
    const episodeCountValue =
      mediaType === "series" || mediaType === "anime" ? (episodeCount.trim() ? Number(episodeCount.trim()) : null) : null;
    const chapterCountValue = mediaType === "manga" ? (chapterCount.trim() ? Number(chapterCount.trim()) : null) : null;

    if (tags.length > 10) {
      setError("You can only add up to 10 genres/themes.");
      return;
    }

    let completedAt: Timestamp | null = null;
    let completionDateUnknown = false;
    if (status === "completed") {
      completionDateUnknown = completionUnknown;
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

    const targetListId = isEditing ? (showListChange ? selectedListId : currentListId || "") : selectedListId;
    const targetList = targetListId ? lists.find((list) => list.id === targetListId) || null : null;
    if (targetListId && !targetList) {
      setError("Select a valid list.");
      return;
    }
    if (targetList && !targetList.types.includes(listMediaType)) {
      setError(`This list only accepts ${targetList.types.map((t) => listTypeLabels[t]).join(", ")} items.`);
      return;
    }
    if (isEditing && showListChange && targetListId !== (currentListId || "")) {
      const confirmed = confirm("Changing the list can affect categorization and filters. Continue?");
      if (!confirmed) return;
    }

    setIsSaving(true);
    try {
      if (isEditing && normalizedInitial?.id) {
        // Update existing entry
        const entryRef = doc(db, "users", uid, "entries", String(normalizedInitial.id));
        await updateDoc(entryRef, {
          title: trimmedTitle,
          mediaType,
          status,
          userRating: userRatingValue,
          imdbRating: imdbRatingValue,
          releaseYear: releaseYearValue,
          lengthMinutes: lengthMinutesValue,
          episodeCount: episodeCountValue,
          chapterCount: chapterCountValue,
          genresThemes: tags,
          description: description.trim(),
          // externalId: normalizedInitial ? String(normalizedInitial.id) : null, // Don't overwrite externalId if not needed, or keep it?
          // If we are editing, we probably shouldn't change externalId unless we re-linked it (not supported yet)
          // image: normalizedInitial?.image || null, // Allow image update?
          image: image, // Use current image state
          // year: releaseYearValue || normalizedInitial?.year || null,
          year: releaseYearValue,
          completedAt,
          completionDateUnknown,
          updatedAt: serverTimestamp(),
        });
        const entryId = String(normalizedInitial.id);
        if (currentListId && currentListId !== targetListId) {
          if (currentListItemId) {
            await deleteDoc(doc(db, "users", uid, "lists", currentListId, "items", currentListItemId));
          } else {
            const currentQuery = query(
              collection(db, "users", uid, "lists", currentListId, "items"),
              where("externalId", "==", entryId),
              limit(1),
            );
            const currentSnap = await getDocs(currentQuery);
            if (!currentSnap.empty) {
              await deleteDoc(doc(db, "users", uid, "lists", currentListId, "items", currentSnap.docs[0].id));
            }
          }
          await updateDoc(doc(db, "users", uid, "lists", currentListId), {
            updatedAt: serverTimestamp(),
          });
        }
        if (targetListId) {
          if (targetListId === currentListId && currentListItemId) {
            await updateDoc(doc(db, "users", uid, "lists", targetListId, "items", currentListItemId), {
              title: trimmedTitle,
              mediaType: listMediaType,
              image: image,
              year: releaseYearValue,
            });
          } else {
            const itemsQuery = query(
              collection(db, "users", uid, "lists", targetListId, "items"),
              where("externalId", "==", entryId),
              limit(1),
            );
            const snapshot = await getDocs(itemsQuery);
            if (snapshot.empty) {
              await addDoc(collection(db, "users", uid, "lists", targetListId, "items"), {
                title: trimmedTitle,
                mediaType: listMediaType,
                externalId: entryId,
                image: image,
                year: releaseYearValue,
                addedAt: serverTimestamp(),
              });
            } else {
              await updateDoc(doc(db, "users", uid, "lists", targetListId, "items", snapshot.docs[0].id), {
                title: trimmedTitle,
                mediaType: listMediaType,
                image: image,
                year: releaseYearValue,
              });
            }
          }
          await updateDoc(doc(db, "users", uid, "lists", targetListId), {
            updatedAt: serverTimestamp(),
          });
        }
        setInfo("Updated.");
      } else {
        // Create new entry
        const entryRef = await addDoc(collection(db, "users", uid, "entries"), {
          title: trimmedTitle,
          mediaType,
          status,
          userRating: userRatingValue,
          imdbRating: imdbRatingValue,
          releaseYear: releaseYearValue,
          lengthMinutes: lengthMinutesValue,
          episodeCount: episodeCountValue,
          chapterCount: chapterCountValue,
          genresThemes: tags,
          description: description.trim(),
          externalId: externalId,
          image: image,
          year: releaseYearValue,
          completedAt,
          completionDateUnknown,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        if (selectedListId) {
          await addDoc(collection(db, "users", uid, "lists", selectedListId, "items"), {
            title: trimmedTitle,
            mediaType: listMediaType,
            externalId: entryRef.id, // Use the new entry ID
            image: image,
            year: releaseYearValue,
            addedAt: serverTimestamp(),
          });
        }
        setInfo("Saved.");
      }

      if (!isEditing) {
        setTitle("");
        setUserRating("");
        setImdbRating("");
        setReleaseYear("");
        setLengthMinutes("");
        setEpisodeCount("");
        setChapterCount("");
        setTags([]);
        setTagInput("");
        setDescription("");
        setCompletionDate("");
        setCompletionUnknown(false);
        setSelectedListId("");
        setCurrentListId(null);
        setCurrentListName("");
        setCurrentListItemId(null);
        setShowListChange(false);
        setImage(null);
        setExternalId(null);
      } else {
        // If editing, close modal after short delay?
        setTimeout(() => onClose(), 1000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save entry.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? "Edit entry" : "Log entry"} className="max-w-5xl bg-neutral-900/60">
      <div className="w-full">
        <div className="flex border-b border-white/5 mb-4 relative">
          <button
            type="button"
            ref={manualTabRef}
            className={cn(
              "relative flex-1 py-2 text-center text-sm font-medium transition-colors",
              activeTab === "manual" ? "text-white" : "text-neutral-400 hover:text-neutral-300",
            )}
            onClick={() => setActiveTab("manual")}
          >
            Manual Entry
          </button>
          <button
            type="button"
            ref={searchTabRef}
            className={cn(
              "relative flex-1 py-2 text-center text-sm font-medium transition-colors",
              activeTab === "search" ? "text-white" : "text-neutral-400 hover:text-neutral-300",
            )}
            onClick={() => setActiveTab("search")}
          >
            Search Online
          </button>
          {indicatorWidth > 0 && (
            <motion.div
              layoutId="activeTabIndicator"
              className="absolute bottom-0 h-0.5 bg-white"
              initial={false}
              animate={{ x: indicatorX, width: indicatorWidth }}
              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            />
          )}
        </div>

        {activeTab === "search" ? (
          <div className="flex flex-col h-[500px]">
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
                {(["movie", "series", "anime", "anime_movie", "manga", "game"] as EntryMediaType[]).map((t) => (
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
                searchResults.map((result) => (
                  <div
                    key={result.id}
                    onClick={() => handleSelectResult(result)}
                    className="flex w-full gap-3 rounded-xl border border-transparent p-2 text-left hover:bg-white/5 hover:border-white/5 transition-all group cursor-pointer"
                  >
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
                ))
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
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex max-h-[500px] flex-col">
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
                    {(["movie", "series", "anime", "anime_movie", "manga", "game"] as EntryMediaType[]).map((value) => (
                      <option key={value} value={value}>
                        {mediaTypeLabels[value]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-medium text-neutral-400">Status</div>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as EntryStatus)}
                    className="w-full rounded-xl bg-neutral-800/50 border border-neutral-100/5 py-3 px-4 text-neutral-100 focus:outline-none focus:border-neutral-100/20 focus:ring-1 focus:ring-neutral-100/20 transition-all"
                  >
                    {(["watching", "completed", "plan_to_watch", "on_hold", "dropped", "unspecified"] as EntryStatus[]).map((value) => (
                      <option key={value} value={value}>
                        {statusLabels[value]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium text-neutral-400">Add to List (Optional)</div>
                  <button
                    type="button"
                    onClick={() => setIsNewListOpen(true)}
                    className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
                  >
                    <Plus size={12} />
                    Create new list
                  </button>
                </div>
                {isEditing && currentListId && !showListChange ? (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-neutral-400">Current List</div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input
                        value={currentListName}
                        readOnly
                        className="w-full rounded-xl bg-neutral-800/50 border border-neutral-100/5 py-3 px-4 text-neutral-100 focus:outline-none focus:border-neutral-100/20 focus:ring-1 focus:ring-neutral-100/20 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setShowListChange(true);
                          setSelectedListId("");
                        }}
                        className="rounded-xl border border-white/10 bg-neutral-800/40 px-4 py-2 text-xs font-semibold text-neutral-200 transition-colors hover:bg-neutral-800 hover:text-white"
                      >
                        Change
                      </button>
                    </div>
                  </div>
                ) : availableLists.length > 0 ? (
                  <select
                    value={selectedListId}
                    onChange={(e) => setSelectedListId(e.target.value)}
                    className="w-full rounded-xl bg-neutral-800/50 border border-neutral-100/5 py-3 px-4 text-neutral-100 focus:outline-none focus:border-neutral-100/20 focus:ring-1 focus:ring-neutral-100/20 transition-all"
                  >
                    <option value="">Select a list...</option>
                    {availableLists.map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsNewListOpen(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-800 bg-neutral-900/50 py-3 text-sm text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors"
                  >
                    <Plus size={16} /> Create your first list
                  </button>
                )}
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
                    <div className="text-xs font-medium text-neutral-400">IMDb rating</div>
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
                      disabled={status !== "completed" || completionUnknown || isSaving}
                      className={cn(
                        "rounded-full border border-neutral-100/10 bg-neutral-800/40 px-3 py-1 text-xs text-neutral-200 transition-colors hover:bg-neutral-800 hover:text-neutral-100",
                        status !== "completed" || completionUnknown || isSaving ? "cursor-not-allowed opacity-70" : ""
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
                          if (!next && status === "completed" && !completionDate) setCompletionDate(todayISODate());
                        }}
                        disabled={status !== "completed" || isSaving}
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
                  disabled={status !== "completed" || completionUnknown || isSaving}
                  className={cn(
                    "w-full rounded-xl bg-neutral-800/50 border border-neutral-100/5 py-3 px-4 text-neutral-100 focus:outline-none focus:border-neutral-100/20 focus:ring-1 focus:ring-neutral-100/20 transition-all",
                    status !== "completed" || completionUnknown || isSaving ? "cursor-not-allowed opacity-70" : ""
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
                <div className="text-xs font-medium text-neutral-400">Description</div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What did you think?"
                  rows={5}
                  className="w-full resize-none rounded-xl bg-neutral-800/50 border border-neutral-100/5 py-3 px-4 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-neutral-100/20 focus:ring-1 focus:ring-neutral-100/20 transition-all"
                />
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
          setSelectedListId(list.id);
          setInfo("List created.");
        }}
      />
    </Modal>
  );
}
