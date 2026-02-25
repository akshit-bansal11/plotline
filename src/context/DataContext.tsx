"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useMemo } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

export type EntryMediaType = "movie" | "series" | "anime" | "manga" | "game";
export type EntryStatus = "watching" | "completed" | "plan_to_watch" | "on_hold" | "dropped" | "unspecified" | "main_story_completed" | "fully_completed" | "backlogged" | "bored" | "own" | "wishlist" | "not_committed" | "committed";

export type EntryDoc = {
  id: string;
  title: string;
  mediaType: EntryMediaType;
  status: EntryStatus;
  userRating: number | null;
  imdbRating: number | null;
  notes: string;
  description: string;
  image: string | null;
  releaseYear: string | null;
  year: string | null;
  externalId: string | null;
  lengthMinutes: number | null;
  episodeCount: number | null;
  chapterCount: number | null;
  // Game specific
  playTime: number | null;
  achievements: number | null;
  totalAchievements: number | null;
  platform: string | null;

  isMovie: boolean;
  listIds: string[];

  createdAtMs: number | null;
  completedAtMs: number | null;
  completionDateUnknown: boolean;
  genresThemes: string[];
  relations: { targetId: string; type: string; createdAtMs: number; inferred?: boolean }[];
};

type EntriesStatus = "idle" | "loading" | "ready" | "error";

interface DataContextType {
  entries: EntryDoc[];
  status: EntriesStatus;
  error: string | null;
  selectedEntry: EntryDoc | null;
  setSelectedEntry: (entry: EntryDoc | null) => void;
  selectedCountry: string | null;
  setSelectedCountry: (country: string | null) => void;
  refresh: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const entriesCache = new Map<string, { entries: EntryDoc[]; updatedAt: number }>();

const coerceMediaType = (value: unknown): EntryMediaType => {
  if (value === "movie" || value === "series" || value === "anime" || value === "manga" || value === "game") return value;
  if (value === "anime_movie") return "anime"; // Output as anime, input should handle isMovie
  return "movie";
};

const coerceStatus = (value: unknown): EntryStatus => {
  if (value === "watching" || value === "completed" || value === "plan_to_watch" || value === "on_hold" || value === "dropped" || value === "unspecified" || value === "main_story_completed" || value === "fully_completed" || value === "backlogged" || value === "bored" || value === "own" || value === "wishlist" || value === "not_committed" || value === "committed") return value;
  return "unspecified";
};

const toNumber = (value: unknown): number | null => {
  if (typeof value !== "number") return null;
  return Number.isFinite(value) ? value : null;
};

const toMillis = (value: unknown): number | null => {
  if (!value) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "object" && value && "toMillis" in value && typeof (value as { toMillis?: unknown }).toMillis === "function") {
    const millis = (value as { toMillis: () => number }).toMillis();
    return typeof millis === "number" && Number.isFinite(millis) ? millis : null;
  }
  return null;
};

const parseEntry = (id: string, raw: Record<string, unknown>): EntryDoc => {
  const genresThemes = Array.isArray(raw.genresThemes) ? raw.genresThemes.filter((v): v is string => typeof v === "string") : [];
  const listIds = Array.isArray(raw.listIds) ? raw.listIds.filter((v): v is string => typeof v === "string") : [];
  const relations = Array.isArray(raw.relations)
    ? (() => {
      const deduped = new Map<string, { targetId: string; type: string; createdAtMs: number; inferred?: boolean }>();
      for (const rawRelation of raw.relations) {
        if (!rawRelation || typeof rawRelation !== "object") continue;
        const relation = rawRelation as Record<string, unknown>;
        const targetId = String(relation.targetId || "").trim();
        const type = String(relation.type || "").trim();
        if (!targetId || !type) continue;
        const createdAtMs = toMillis(relation.createdAtMs) ?? toMillis(relation.createdAt) ?? 0;
        const key = `${targetId}::${type}`;
        if (!deduped.has(key)) {
          deduped.set(key, { targetId, type, createdAtMs, inferred: relation.inferred === true });
        }
      }
      return Array.from(deduped.values());
    })()
    : [];

  // Handle legacy anime_movie type from DB if present
  let mediaType = coerceMediaType(raw.mediaType);
  let isMovie = !!raw.isMovie;

  if (raw.mediaType === "anime_movie") {
    mediaType = "anime";
    isMovie = true;
  }

  return {
    id,
    title: String(raw.title || ""),
    mediaType,
    status: coerceStatus(raw.status),
    userRating: typeof raw.userRating === "number" ? raw.userRating : typeof raw.rating === "number" ? raw.rating : null,
    imdbRating: typeof raw.imdbRating === "number" ? raw.imdbRating : null,
    notes: String(raw.notes || ""),
    description: String(raw.description || ""),
    image: raw.image ? String(raw.image) : null,
    releaseYear: raw.releaseYear ? String(raw.releaseYear) : raw.year ? String(raw.year) : null,
    year: raw.year ? String(raw.year) : raw.releaseYear ? String(raw.releaseYear) : null,
    externalId: raw.externalId ? String(raw.externalId) : null,
    lengthMinutes: toNumber(raw.lengthMinutes),
    episodeCount: toNumber(raw.episodeCount),
    chapterCount: toNumber(raw.chapterCount),
    playTime: toNumber(raw.playTime),
    achievements: toNumber(raw.achievements),
    totalAchievements: toNumber(raw.totalAchievements),
    platform: raw.platform ? String(raw.platform) : null,
    isMovie,
    listIds,
    createdAtMs: toMillis(raw.createdAt),
    completedAtMs: toMillis(raw.completedAt),
    completionDateUnknown: Boolean(raw.completionDateUnknown),
    genresThemes,
    relations,
  };
};

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid || null;
  const [entries, setEntries] = useState<EntryDoc[]>([]);
  const [status, setStatus] = useState<EntriesStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState(0);
  const [selectedEntry, setSelectedEntry] = useState<EntryDoc | null>(null);
  const [selectedCountry, setSelectedCountryState] = useState<string | null>(() => {
    try {
      return localStorage.getItem("plotline_selected_country") ?? null;
    } catch {
      return null;
    }
  });

  const setSelectedCountry = (country: string | null) => {
    setSelectedCountryState(country);
    try {
      if (country) {
        localStorage.setItem("plotline_selected_country", country);
      } else {
        localStorage.removeItem("plotline_selected_country");
      }
    } catch { /* localStorage unavailable */ }
  };

  const refresh = () => setToken((prev) => prev + 1);

  useEffect(() => {
    if (!uid) return;

    const cached = entriesCache.get(uid);
    if (cached) {
      queueMicrotask(() => {
        setEntries(cached.entries);
        setStatus("ready");
      });
    } else {
      queueMicrotask(() => {
        setStatus("loading");
      });
    }

    const entriesQuery = query(collection(db, "users", uid, "entries"), orderBy("createdAt", "desc"), limit(1000));
    const unsubscribe = onSnapshot(
      entriesQuery,
      (snapshot) => {
        const next = snapshot.docs.map((docSnap) => parseEntry(docSnap.id, docSnap.data() as Record<string, unknown>));
        const updatedAt = Date.now();
        entriesCache.set(uid, { entries: next, updatedAt });
        setEntries(next);
        setStatus("ready");
        setError(null);
      },
      (err) => {
        console.error("Data sync error:", err);
        setError(err.message);
        setStatus("error");
      }
    );

    return () => unsubscribe();
  }, [uid, token]);

  const value = useMemo(
    () => {
      const safeEntries = uid ? entries : [];
      const safeStatus = uid ? status : "idle";
      const safeError = uid ? error : null;
      const safeSelectedEntry = uid ? selectedEntry : null;
      return {
        entries: safeEntries,
        status: safeStatus,
        error: safeError,
        selectedEntry: safeSelectedEntry,
        setSelectedEntry,
        selectedCountry,
        setSelectedCountry,
        refresh,
      };
    },
    [uid, entries, status, error, selectedEntry, selectedCountry],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
}
