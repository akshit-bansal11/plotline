"use client";

// ─── Firebase ────────────────────────────────────────────────────────────────
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

// ─── Icons ────────────────────────────────────────────────────────────────────
import {
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

// ─── React ────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from "react";

// ─── Internal imports ─────────────────────────────────────────────────────────
import { NewListModal } from "@/components/lists/NewListModal";
import { InfographicToast } from "@/components/overlay/InfographicToast";
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

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

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

type ListMediaType = "movie" | "series" | "anime" | "manga" | "game";

type EditableRelation = {
  targetId: string;
  type: string;
  title: string;
  image: string | null;
  mediaType: string;
};

export type LoggableMedia = {
  id: string | number;
  title: string;
  image: string | null;
  year?: string;
  releaseYear?: string;
  type: EntryMediaType | "anime_movie";
  description?: string;
  userRating?: number | null;
  imdbRating?: number | null;
  rating?: number | null;
  lengthMinutes?: number | null;
  episodeCount?: number | null;
  chapterCount?: number | null;
  playTime?: number | null;
  achievements?: number | null;
  totalAchievements?: number | null;
  platform?: string | null;
  isMovie?: boolean;
  listIds?: string[];
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

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS / DATA
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────────────────────────

const todayISODate = (): string => {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
};

const formatISODate = (millis: number): string => {
  const d = new Date(millis);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
};

const parseISODate = (value: string): { date: Date; millis: number } | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(y, m - 1, d, 12, 0, 0, 0);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return { date, millis: date.getTime() };
};

const buildEditableRelations = (
  raw: Array<{ targetId: string; type: string }>,
  entries: EntryDoc[],
): EditableRelation[] => {
  const seen = new Set<string>();
  return raw.reduce<EditableRelation[]>((acc, r) => {
    const targetId = String(r.targetId || "").trim();
    const type = String(r.type || "").trim();
    if (!targetId || !type || seen.has(targetId)) return acc;
    seen.add(targetId);
    const match = entries.find((e) => String(e.id) === targetId);
    acc.push({
      targetId,
      type,
      title: match?.title ?? "Unknown Entry",
      image: match?.image ?? null,
      mediaType: match?.mediaType ?? "movie",
    });
    return acc;
  }, []);
};

// ─────────────────────────────────────────────────────────────────────────────
// LABEL MAPS
// ─────────────────────────────────────────────────────────────────────────────

const statusLabels: Record<EntryStatus, string> = entryStatusLabels;
const mediaTypeLabels: Record<EntryMediaType, string> = entryMediaTypeLabels;

// ─────────────────────────────────────────────────────────────────────────────
// REUSABLE SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

// Uppercase monospaced section divider used in right panel
function SectionHeader({ title }: { title: string }) {
  return (
    <div className="mt-8 mb-4 first:mt-0">
      <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#555] mb-2">
        {title}
      </div>
      <div className="h-px w-full bg-white/5" />
    </div>
  );
}

// Labeled stat column used in left panel metadata row
function StatColumn({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[9px] font-mono uppercase tracking-[0.1em] text-[#555]">{label}</div>
      <div className="text-[22px] font-extrabold text-white leading-none tracking-tight">
        {value}
      </div>
    </div>
  );
}

// Inline-editable wrapper: shows display text by default, pencil on hover, input on click
function InlineEditable({
  value,
  onCommit,
  type = "text",
  className = "",
  fieldId,
  activeField,
  setActiveField,
  multiline = false,
  children,
}: {
  value: string;
  onCommit: (v: string) => void;
  type?: string;
  className?: string;
  fieldId: string;
  activeField: string | null;
  setActiveField: (f: string | null) => void;
  multiline?: boolean;
  children?: React.ReactNode;
}) {
  const isActive = activeField === fieldId;
  const [local, setLocal] = useState(value);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  const commit = () => {
    onCommit(local);
    setActiveField(null);
  };

  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isActive) return;

    if (multiline) textareaRef.current?.focus();
    else inputRef.current?.focus();
  }, [isActive, multiline]);

  const inputCls =
    "w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/20 transition-all";

  if (isActive) {
    return multiline ? (
      <textarea
        ref={textareaRef}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") setActiveField(null);
        }}
        className={cn(inputCls, className, "min-h-[80px] resize-none")}
      />
    ) : (
      <input
        ref={inputRef}
        type={type}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setActiveField(null);
        }}
        className={cn(inputCls, className)}
      />
    );
  }

  return (
    <div className="group relative cursor-pointer" onClick={() => setActiveField(fieldId)}>
      {children ?? (
        <div className={className}>{value || <span className="text-[#333]">—</span>}</div>
      )}
      {/* Pencil icon */}
      <span className="absolute -top-1 -right-5 opacity-0 group-hover:opacity-100 transition-opacity p-1 pointer-events-none">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#666"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
        </svg>
      </span>
    </div>
  );
}

// 10-star interactive rating — fills stars on hover, sets userRating on click
function StarRating({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [hover, setHover] = useState(0);
  const numeric = parseFloat(value) || 0;

  return (
    <div className="flex items-center gap-4">
      <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
        {Array.from({ length: 10 }, (_, i) => {
          const n = i + 1;
          const filled = (hover || numeric) >= n;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onChange(String(n))}
              onMouseEnter={() => setHover(n)}
              className="transition-transform hover:scale-110 focus:outline-none"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill={filled ? "#fff" : "none"}
                stroke={filled ? "#fff" : "#333"}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </button>
          );
        })}
      </div>
      <span className="text-[18px] font-extrabold text-white min-w-[3ch]">
        {numeric > 0 ? numeric.toFixed(1) : "0.0"}
      </span>
    </div>
  );
}

// +/− stepper for episode, season, rewatch
function Stepper({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: number;
  onValueChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#555]">{label}</div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onValueChange(Math.max(0, value - 1))}
          className="w-7 h-7 rounded-full flex items-center justify-center bg-[#1a1a1a] border border-white/10 text-white hover:border-white/20 transition-all"
        >
          <svg width="10" height="2" viewBox="0 0 10 2" fill="none">
            <rect width="10" height="2" rx="1" fill="currentColor" />
          </svg>
        </button>
        <span className="text-[14px] font-medium text-white min-w-[24px] text-center">{value}</span>
        <button
          type="button"
          onClick={() => onValueChange(value + 1)}
          className="w-7 h-7 rounded-full flex items-center justify-center bg-[#1a1a1a] border border-white/10 text-white hover:border-white/20 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// Custom dark dropdown — replaces native <select> for relation type
// Native select option lists ignore background-color on most OS/browsers
function CustomDropdown({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg py-2.5 px-4 text-[13px] text-white flex items-center justify-between hover:border-white/20 focus:outline-none transition-all"
      >
        <span>{value}</span>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-[#555] transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <ul className="absolute bottom-full left-0 right-0 mb-1 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-2xl z-[100] max-h-48 overflow-y-auto">
          {options.map((opt) => (
            <li
              key={opt}
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              className={cn(
                "px-4 py-2.5 text-[13px] cursor-pointer transition-colors",
                opt === value
                  ? "text-white bg-white/[0.06]"
                  : "text-[#aaa] hover:bg-white/[0.03] hover:text-white",
              )}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOKS
// ─────────────────────────────────────────────────────────────────────────────

// Locks body scroll while modal is open; restores on close / unmount
function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev || "";
    };
  }, [active]);
}

// Calls onClose when Escape is pressed while modal is open
function useEscapeKey(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, onClose]);
}

// Loads + live-syncs the user's lists from Firestore
function useLists(uid: string | null, isOpen: boolean) {
  const [lists, setLists] = useState<
    { id: string; name: string; type: ListMediaType; types: ListMediaType[] }[]
  >([]);

  useEffect(() => {
    if (!uid || !isOpen) {
      setLists([]);
      return;
    }
    const q = query(collection(db, "users", uid, "lists"), orderBy("createdAt", "desc"), limit(50));
    return onSnapshot(q, (snap) => {
      setLists(
        snap.docs.map((d) => {
          const data = d.data() as { name?: string; type?: string; types?: string[] };
          const singleType = (
            ["movie", "series", "anime", "manga", "game"].includes(data.type ?? "")
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
          return { id: d.id, name: data.name || "Untitled List", type: singleType, types };
        }),
      );
    });
  }, [uid, isOpen]);

  return lists;
}

// Finds which lists a given entry already belongs to (for edit mode)
function useInitialListIds(
  uid: string | null,
  isOpen: boolean,
  isEditing: boolean,
  entryId: string | number | null | undefined,
  listIds: string[] | undefined,
  lists: { id: string }[],
  setSelectedListIds: (ids: Set<string>) => void,
  setInitialListIds: (ids: Set<string>) => void,
) {
  const fetchedRef = useRef<string | number | null>(null);

  useEffect(() => {
    if (!uid || !isOpen || !isEditing || !entryId || lists.length === 0) return;
    if (fetchedRef.current === entryId) return;

    let cancelled = false;

    (async () => {
      if (listIds && listIds.length > 0) {
        if (cancelled) return;
        const ids = new Set(listIds);
        setSelectedListIds(ids);
        setInitialListIds(ids);
        fetchedRef.current = entryId;
        return;
      }

      const strId = String(entryId);
      const found = new Set<string>();
      const checks = lists.map(async (list) => {
        const snap = await getDocs(
          query(
            collection(db, "users", uid, "lists", list.id, "items"),
            where("externalId", "==", strId),
            limit(1),
          ),
        );
        return snap.empty ? null : list.id;
      });
      (await Promise.all(checks)).forEach((id) => {
        if (id) found.add(id);
      });
      if (cancelled) return;
      setSelectedListIds(found);
      setInitialListIds(found);
      fetchedRef.current = entryId;
    })();

    return () => {
      cancelled = true;
    };
  }, [uid, isOpen, isEditing, entryId, listIds, lists, setSelectedListIds, setInitialListIds]);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

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
  const uid = user?.uid ?? null;

  // ── Modal behaviour ─────────────────────────────────────────────────────────
  useBodyScrollLock(isOpen);
  useEscapeKey(isOpen, onClose);

  // ── Left-panel editable field tracking ─────────────────────────────────────
  const [activeField, setActiveField] = useState<string | null>(null);

  // ── Core media fields ────────────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [mediaType, setMediaType] = useState<EntryMediaType>("movie");
  const [isMovie, setIsMovie] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [externalId, setExternalId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [releaseYear, setReleaseYear] = useState("");
  const [director, setDirector] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [imdbRating, setImdbRating] = useState("");

  // Numeric counts (sourced from API / user edit)
  const [episodeCount, setEpisodeCount] = useState("");
  const [chapterCount, setChapterCount] = useState("");
  const [lengthMinutes, setLengthMinutes] = useState("");

  // ── User-progress fields (right panel) ──────────────────────────────────────
  const [status, setStatus] = useState<EntryStatus>("unspecified");
  const [userRating, setUserRating] = useState("");
  const [currentEpisodes, setCurrentEpisodes] = useState(0);
  const [currentSeasons, setCurrentSeasons] = useState(0);
  const [totalSeasons, setTotalSeasons] = useState(0);
  const [currentChapters, setCurrentChapters] = useState(0);
  const [rewatchCount, setRewatchCount] = useState(0);

  // ── Game fields ──────────────────────────────────────────────────────────────
  const [playTime, setPlayTime] = useState("");
  const [achievements, setAchievements] = useState("");
  const [totalAchievements, setTotalAchievements] = useState("");
  const [platform, setPlatform] = useState("");
  const [isCustomPlatform, setIsCustomPlatform] = useState(false);

  // ── Dates ────────────────────────────────────────────────────────────────────
  const [startDate, setStartDate] = useState("");
  const [completionDate, setCompletionDate] = useState("");
  const [completionUnknown, setCompletionUnknown] = useState(false);

  // ── Lists ────────────────────────────────────────────────────────────────────
  const [selectedListIds, setSelectedListIds] = useState<Set<string>>(new Set());
  const [initialListIds, setInitialListIds] = useState<Set<string>>(new Set());
  const [isNewListOpen, setIsNewListOpen] = useState(false);

  // ── Relations ────────────────────────────────────────────────────────────────
  const [originalRelations, setOriginalRelations] = useState<
    { targetId: string; type: string; createdAtMs: number }[]
  >([]);
  const [relations, setRelations] = useState<EditableRelation[]>([]);
  const [relationQuery, setRelationQuery] = useState("");
  const [selectedRelationDoc, setSelectedRelationDoc] = useState<EntryDoc | null>(null);
  const [selectedRelationType, setSelectedRelationType] = useState<RelationType>("Sequel");

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);
  const [duplicateToast, setDuplicateToast] = useState<{ id: number; message: string } | null>(
    null,
  );
  const tagRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeField === "left-tags") {
      tagRef.current?.focus();
    }
  }, [activeField]);

  // ── External data ────────────────────────────────────────────────────────────
  const lists = useLists(uid, isOpen);
  const listMediaType = mediaType;

  useInitialListIds(
    uid,
    isOpen,
    isEditing,
    initialMedia?.id,
    initialMedia?.listIds,
    lists,
    setSelectedListIds,
    setInitialListIds,
  );

  // ── Derived ──────────────────────────────────────────────────────────────────
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

  // ── Validation ───────────────────────────────────────────────────────────────
  const userRatingError = useMemo(() => {
    const raw = userRating.trim();
    if (!raw) return null;
    const v = Number(raw);
    if (!Number.isInteger(v) || v < 1 || v > 10) return "Rating must be 1–10.";
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

  // ── Initialise form when modal opens ─────────────────────────────────────────
  const initializedRef = useRef<string | number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      initializedRef.current = null;
      setDuplicateToast(null);
      return;
    }

    if (normalizedInitial) {
      if (normalizedInitial.id && initializedRef.current === normalizedInitial.id) return;
      initializedRef.current = normalizedInitial.id;

      setTitle(normalizedInitial.title);
      setMediaType(normalizedInitial.inferredType);
      setIsMovie(!!normalizedInitial.inferredIsMovie);
      setImage(normalizedInitial.image ?? null);
      setExternalId(normalizedInitial.id ? String(normalizedInitial.id) : null);
      setDescription(normalizedInitial.description ?? "");
      setReleaseYear(normalizedInitial.releaseYear ?? normalizedInitial.year ?? "");
      setDirector("");
      setTags(
        Array.isArray(normalizedInitial.genresThemes)
          ? normalizedInitial.genresThemes.slice(0, 10)
          : [],
      );
      setTagInput("");
      setEpisodeCount(normalizedInitial.episodeCount ? String(normalizedInitial.episodeCount) : "");
      setChapterCount(normalizedInitial.chapterCount ? String(normalizedInitial.chapterCount) : "");
      setLengthMinutes(
        normalizedInitial.lengthMinutes ? String(normalizedInitial.lengthMinutes) : "",
      );

      const uRating =
        typeof normalizedInitial.userRating === "number"
          ? normalizedInitial.userRating
          : isEditing && typeof normalizedInitial.rating === "number"
            ? normalizedInitial.rating
            : null;
      setUserRating(
        uRating != null && uRating >= 1 && uRating <= 10 ? String(Math.round(uRating)) : "",
      );

      const iRating =
        typeof normalizedInitial.imdbRating === "number"
          ? normalizedInitial.imdbRating
          : typeof normalizedInitial.rating === "number"
            ? normalizedInitial.rating
            : null;
      setImdbRating(iRating != null && iRating >= 0 && iRating <= 10 ? String(iRating) : "");

      setStatus(normalizedInitial.status ?? "unspecified");

      setPlatform(normalizedInitial.platform ?? "");
      setIsCustomPlatform(
        !!normalizedInitial.platform &&
        !PLATFORM_OPTIONS.some((p) => p.id === normalizedInitial.platform),
      );
      setPlayTime(normalizedInitial.playTime ? String(normalizedInitial.playTime) : "");
      setAchievements(normalizedInitial.achievements ? String(normalizedInitial.achievements) : "");
      setTotalAchievements(
        normalizedInitial.totalAchievements ? String(normalizedInitial.totalAchievements) : "",
      );

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
      setStartDate("");

      if (normalizedInitial.relations) {
        const cleaned = normalizedInitial.relations
          .filter((r) => !r.inferred)
          .map((r) => ({
            targetId: String(r.targetId || "").trim(),
            type: String(r.type || "").trim(),
            createdAtMs: Number.isFinite(r.createdAtMs) ? r.createdAtMs : Date.now(),
          }))
          .filter((r) => r.targetId && r.type);
        setOriginalRelations(cleaned);
        setRelations(buildEditableRelations(cleaned, entries));
      } else {
        setOriginalRelations([]);
        setRelations([]);
      }

      setError(null);
      setInfo(null);
    } else if (initializedRef.current !== "new") {
      initializedRef.current = "new";
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
      setTagInput("");
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
    }
  }, [isOpen, normalizedInitial, entries, isEditing]);

  // Keep relation display data fresh when entries update
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

  // Auto-set completion date when status switches to completed
  useEffect(() => {
    if (!isOpen) return;
    if (status !== "completed") {
      if (completionDate) setCompletionDate("");
      if (completionUnknown) setCompletionUnknown(false);
      return;
    }
    if (!completionUnknown && !completionDate) setCompletionDate(todayISODate());
  }, [status, isOpen]);

  // ── Submit ────────────────────────────────────────────────────────────────────
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
    if (status === "completed") {
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

    if (!isEditing) {
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
      const entryId = isEditing && normalizedInitial?.id ? String(normalizedInitial.id) : null;

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
        playTime: playTimeValue,
        achievements: achievementsValue,
        totalAchievements: totalAchievementsValue,
        platform: platformValue,
        isMovie,
        genresThemes: tags,
        description: description.trim(),
        image,
        completedAt,
        completionDateUnknown: completionDateUnknownValue,
        updatedAt: serverTimestamp(),
        listIds: Array.from(selectedListIds),
        relations: relationPayload,
      };

      let finalEntryId = entryId;

      if (isEditing && entryId) {
        await updateDoc(doc(db, "users", uid, "entries", entryId), entryData);
        setInfo("Updated.");
      } else {
        const ref = await addDoc(collection(db, "users", uid, "entries"), {
          ...entryData,
          externalId,
          createdAt: serverTimestamp(),
        });
        finalEntryId = ref.id;
        setInfo("Saved.");
      }

      if (!finalEntryId) throw new Error("No entry ID");

      const addedIds = Array.from(selectedListIds).filter((id) => !initialListIds.has(id));
      const removedIds = Array.from(initialListIds).filter((id) => !selectedListIds.has(id));
      const commonIds = Array.from(selectedListIds).filter((id) => initialListIds.has(id));

      await Promise.all([
        ...addedIds.map((listId) =>
          addDoc(collection(db, "users", uid, "lists", listId, "items"), {
            title: trimmedTitle,
            mediaType: listMediaType,
            externalId: finalEntryId,
            image,
            year: releaseYearValue,
            addedAt: serverTimestamp(),
          }).then(() =>
            updateDoc(doc(db, "users", uid, "lists", listId), { updatedAt: serverTimestamp() }),
          ),
        ),
        ...removedIds.map(async (listId) => {
          const snap = await getDocs(
            query(
              collection(db, "users", uid, "lists", listId, "items"),
              where("externalId", "==", finalEntryId),
              limit(1),
            ),
          );
          if (!snap.empty) {
            await deleteDoc(doc(db, "users", uid, "lists", listId, "items", snap.docs[0].id));
            await updateDoc(doc(db, "users", uid, "lists", listId), {
              updatedAt: serverTimestamp(),
            });
          }
        }),
        ...commonIds.map(async (listId) => {
          const snap = await getDocs(
            query(
              collection(db, "users", uid, "lists", listId, "items"),
              where("externalId", "==", finalEntryId),
              limit(1),
            ),
          );
          if (!snap.empty)
            await updateDoc(doc(db, "users", uid, "lists", listId, "items", snap.docs[0].id), {
              title: trimmedTitle,
              mediaType: listMediaType,
              image,
              year: releaseYearValue,
            });
        }),
      ]);

      await updateBidirectionalRelations(
        uid,
        finalEntryId,
        originalRelations,
        relationPayload.map(({ targetId, type }) => ({ targetId, type })),
      );

      if (isEditing) {
        setTimeout(onClose, 1000);
      } else {
        // Reset for next entry
        setTitle("");
        setImage(null);
        setExternalId(null);
        setDescription("");
        setReleaseYear("");
        setDirector("");
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
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setIsSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  if (!isOpen) return null;

  // Shared props passed to every InlineEditable in the left panel
  const editableProps = { activeField, setActiveField };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/75 backdrop-blur-sm">
      <div
        className="relative w-full max-w-[1000px] bg-[#111] rounded-2xl overflow-hidden flex flex-col shadow-2xl border border-white/5"
        style={{ height: "min(720px, 90vh)" }}
      >
        <form onSubmit={onSubmit} className="flex flex-col h-full overflow-hidden">
          {/* ── PANELS ─────────────────────────────────────────────────────────── */}
          <div className="flex-1 flex overflow-hidden min-h-0">
            {/* ── LEFT PANEL — Media card, read-display + inline-editable ───────── */}
            <div className="w-[420px] shrink-0 border-r border-white/5 overflow-y-auto p-7 flex flex-col bg-[#111]">
              {/* Top row: category label + type badge */}
              <div className="flex justify-between items-center mb-4">
                <span className="text-[10px] font-mono text-[#555] uppercase tracking-[0.14em]">
                  CULTURAL LEGACY
                </span>
                <span className="px-3 py-1 rounded-full border border-white/10 text-[11px] font-mono text-white/50 uppercase tracking-wider">
                  {mediaTypeLabels[mediaType] ?? mediaType}
                </span>
              </div>

              {/* Poster */}
              <div className="relative w-full aspect-[16/10] rounded-xl overflow-hidden mb-6 bg-[#1f1f1f]">
                {image ? (
                  <ImageWithSkeleton src={image} alt={title} fill className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Search className="w-8 h-8 text-[#333]" />
                  </div>
                )}
              </div>

              {/* Title */}
              <InlineEditable
                value={title}
                onCommit={setTitle}
                fieldId="left-title"
                {...editableProps}
                className="text-[clamp(26px,3.5vw,38px)] font-black leading-[1.1] uppercase tracking-[-0.02em] text-white mb-2 pr-5"
              />

              {/* Director + Year subtitle */}
              <div className="text-sm text-[#666] mb-6 flex items-center gap-1.5 flex-wrap">
                <span>Directed by</span>
                <InlineEditable
                  value={director || "—"}
                  onCommit={setDirector}
                  fieldId="left-director"
                  {...editableProps}
                  className="font-medium text-[#888] pr-5"
                />
                <span>·</span>
                <InlineEditable
                  value={releaseYear}
                  onCommit={setReleaseYear}
                  type="number"
                  fieldId="left-year"
                  {...editableProps}
                  className="font-medium text-[#888] pr-5"
                />
              </div>

              {/* Stats row: Episodes / Seasons / Rating */}
              <div className="grid grid-cols-3 gap-4 mb-6">
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
                    value={totalSeasons ? String(totalSeasons).padStart(2, "0") : "01"}
                  />
                </InlineEditable>

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

              {/* Genre pills + edit button */}
              <div className="flex flex-wrap gap-1.5 mb-5">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 rounded-full border border-white/[0.08] bg-[#1a1a1a] text-[10px] text-[#aaa] font-mono uppercase tracking-[0.08em]"
                  >
                    {tag}
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() => setActiveField("left-tags")}
                  className="px-3 py-1 rounded-full border border-dashed border-white/10 text-[10px] font-mono text-[#555] hover:text-[#888] hover:border-white/20 transition-all"
                >
                  + EDIT
                </button>
                {activeField === "left-tags" && (
                  <div className="w-full mt-2">
                    <input
                      ref={tagRef}
                      placeholder="Comma-separated tags…"
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

              {/* Description */}
              <InlineEditable
                value={description}
                onCommit={setDescription}
                fieldId="left-desc"
                multiline
                {...editableProps}
                className="text-[13px] text-[#555] leading-[1.6] italic line-clamp-3 pr-5"
              />

              {isFetchingMetadata && (
                <div className="mt-4 flex items-center gap-2 text-[11px] font-mono text-[#555]">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Fetching metadata…
                </div>
              )}
            </div>

            {/* ── RIGHT PANEL — All user-editable progress fields ────────────────── */}
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
                      const next = e.target.value as EntryStatus;
                      setStatus(next);
                      if (next === "completed" && !completionDate && !completionUnknown)
                        setCompletionDate(todayISODate());
                    }}
                    style={{ colorScheme: "dark" }}
                    className="w-full bg-[#1a1a1a] border border-white/10 rounded-full py-2.5 px-5 pr-10 appearance-none text-[13px] text-white focus:outline-none focus:border-white/20 transition-all"
                  >
                    <option value="unspecified">Select status…</option>
                    {(mediaType === "game" ? GAME_STATUS_OPTIONS : STANDARD_STATUS_OPTIONS).map(
                      (s) => (
                        <option key={s} value={s}>
                          {statusLabels[s]}
                        </option>
                      ),
                    )}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555] pointer-events-none" />
                </div>
              </div>

              {/* SCORE */}
              <div className="mb-6 p-4 bg-[#1a1a1a] rounded-xl border border-white/[0.05]">
                <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-[#555] mb-3">
                  SCORE
                </div>
                <StarRating value={userRating} onChange={setUserRating} />
              </div>

              {/* PROGRESS STEPPERS */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                {(mediaType === "series" || mediaType === "anime") && (
                  <Stepper
                    label="EPISODE"
                    value={currentEpisodes}
                    onValueChange={setCurrentEpisodes}
                  />
                )}
                {mediaType === "manga" && (
                  <Stepper
                    label="CHAPTER"
                    value={currentChapters}
                    onValueChange={setCurrentChapters}
                  />
                )}
                {mediaType !== "movie" && (
                  <Stepper
                    label="SEASON"
                    value={currentSeasons}
                    onValueChange={setCurrentSeasons}
                  />
                )}
              </div>

              <div className="mb-6">
                <Stepper
                  label="REWATCH COUNT"
                  value={rewatchCount}
                  onValueChange={setRewatchCount}
                />
              </div>

              {/* ARCHIVAL LISTS */}
              <SectionHeader title="Archival Lists" />
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

              {/* ARCHIVAL DATES */}
              <SectionHeader title="Archival Dates" />
              <div className="grid grid-cols-2 gap-5 mb-2">
                {/* Date Started */}
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#555] mb-2">
                    STARTED
                  </div>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
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
                      className="text-[10px] font-mono uppercase tracking-[0.1em] text-[#555] hover:text-white transition-colors"
                    >
                      UNKNOWN
                    </button>
                  </div>
                </div>

                {/* Date Completed */}
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#555] mb-2">
                    COMPLETED
                  </div>
                  <input
                    type="date"
                    value={completionDate}
                    onChange={(e) => setCompletionDate(e.target.value)}
                    disabled={completionUnknown}
                    style={{ colorScheme: "dark" }}
                    className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg py-3 px-4 text-[13px] text-white focus:outline-none focus:border-white/20 transition-all disabled:opacity-40"
                  />
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
                        else setCompletionDate(todayISODate());
                      }}
                      className={cn(
                        "text-[10px] font-mono uppercase tracking-[0.1em] transition-colors",
                        completionUnknown ? "text-white" : "text-[#555] hover:text-white",
                      )}
                    >
                      UNKNOWN
                    </button>
                  </div>
                </div>
              </div>

              {/* RELATIONS */}
              <SectionHeader title="Relations" />

              {/* Search input */}
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

              {/* Existing relation chips */}
              {relations.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {relations.map((rel, idx) => (
                    <div
                      key={`${rel.targetId}-${idx}`}
                      className="flex items-center gap-3 bg-[#1a1a1a] border border-white/5 p-2 pr-3 rounded-lg"
                    >
                      <div className="w-8 h-12 relative rounded overflow-hidden bg-[#222] shrink-0">
                        {rel.image && (
                          <ImageWithSkeleton src={rel.image} alt="" fill className="object-cover" />
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

              {/* Confirm panel for selected relation */}
              {selectedRelationDoc && (
                <div className="p-4 bg-[#1a1a1a] rounded-xl border border-white/10 space-y-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-14 relative rounded overflow-hidden bg-[#222] shrink-0">
                      {selectedRelationDoc.image && (
                        <ImageWithSkeleton
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

              {/* Error / info feedback */}
              {error && <div className="mt-4 text-[12px] font-mono text-red-400">{error}</div>}
              {info && <div className="mt-4 text-[12px] font-mono text-emerald-400">{info}</div>}
            </div>
          </div>

          {/* ── FOOTER BAR ─────────────────────────────────────────────────────── */}
          <div className="h-16 shrink-0 bg-[#111] border-t border-white/[0.06] px-6 flex items-center justify-between z-30">
            <button
              type="button"
              onClick={onClose}
              className="text-[11px] font-mono uppercase tracking-[0.12em] text-[#555] hover:text-[#888] transition-colors"
            >
              DISCARD DRAFT
            </button>
            <span className="text-[11px] font-mono uppercase tracking-[0.12em] text-[#2a2a2a]">
              PRESS ESC TO EXIT
            </span>
            <button
              type="submit"
              disabled={isSaving}
              className="bg-white text-[#111] px-7 py-2.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-[0.14em] hover:bg-neutral-200 transition-colors disabled:opacity-50"
            >
              {isSaving ? "SAVING…" : "SAVE ENTRY"}
            </button>
          </div>
        </form>
      </div>

      {/* ── PORTALS ──────────────────────────────────────────────────────────── */}
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
    </div>
  );
}
