"use client";

import { useEffect, useMemo, useState } from "react";
import { Timestamp, addDoc, collection, serverTimestamp, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/auth-context";

type EntryMediaType = "movie" | "series" | "anime" | "anime_movie" | "manga" | "game";
type EntryStatus = "watching" | "completed" | "plan_to_watch" | "dropped";

export type LoggableMedia = {
  id: string | number;
  title: string;
  image: string | null;
  year?: string;
  type: "movie" | "series" | "anime" | "manga" | "game";
  description?: string;
  rating?: number | null;
  lengthMinutes?: number | null;
  episodeCount?: number | null;
  chapterCount?: number | null;
  genresThemes?: string[];
};

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

const todayISODate = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
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

export function LogEntryModal({
  isOpen,
  onClose,
  initialMedia,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialMedia?: LoggableMedia | null;
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [mediaType, setMediaType] = useState<EntryMediaType>("movie");
  const [status, setStatus] = useState<EntryStatus>("watching");
  const [rating, setRating] = useState<string>("");
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

  const [lists, setLists] = useState<{ id: string; name: string }[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>("");

  const uid = user?.uid || null;

  useEffect(() => {
    if (!uid || !isOpen) {
      setLists([]);
      return;
    }

    const q = query(collection(db, "users", uid, "lists"), orderBy("updatedAt", "desc"), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLists(snapshot.docs.map((doc) => ({ id: doc.id, name: doc.data().name || "Untitled List" })));
    });

    return () => unsubscribe();
  }, [uid, isOpen]);

  const normalizedInitial = useMemo(() => {
    if (!initialMedia) return null;
    const inferredType: EntryMediaType =
      initialMedia.type === "anime"
        ? "anime"
        : initialMedia.type === "manga"
          ? "manga"
          : initialMedia.type === "game"
            ? "game"
            : initialMedia.type === "series"
              ? "series"
              : "movie";
    return { ...initialMedia, inferredType };
  }, [initialMedia]);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setInfo(null);
    if (normalizedInitial) {
      setTitle(normalizedInitial.title);
      setMediaType(normalizedInitial.inferredType);
      setStatus("watching");
      if (typeof normalizedInitial.rating === "number" && normalizedInitial.rating >= 1 && normalizedInitial.rating <= 10) {
        setRating(String(Math.round(normalizedInitial.rating)));
      } else {
        setRating("");
      }
      setLengthMinutes(normalizedInitial.lengthMinutes ? String(normalizedInitial.lengthMinutes) : "");
      setEpisodeCount(normalizedInitial.episodeCount ? String(normalizedInitial.episodeCount) : "");
      setChapterCount(normalizedInitial.chapterCount ? String(normalizedInitial.chapterCount) : "");
      setTags(Array.isArray(normalizedInitial.genresThemes) ? normalizedInitial.genresThemes.slice(0, 10) : []);
      setTagInput("");
      setDescription(normalizedInitial.description || "");
      setCompletionDate("");
      setCompletionUnknown(false);
      setSelectedListId("");
    } else {
      setTitle("");
      setMediaType("movie");
      setStatus("watching");
      setRating("");
      setLengthMinutes("");
      setEpisodeCount("");
      setChapterCount("");
      setTags([]);
      setTagInput("");
      setDescription("");
      setCompletionDate("");
      setCompletionUnknown(false);
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

  const ratingError = useMemo(() => {
    const raw = rating.trim();
    if (!raw) return null;
    if (!/^\d+$/.test(raw)) return "Rating must be a whole number from 1 to 10.";
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 1 || value > 10) return "Rating must be between 1 and 10.";
    return null;
  }, [rating]);

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

    if (ratingError) {
      setError(ratingError);
      return;
    }
    const ratingValue = rating.trim() ? Number(rating.trim()) : null;

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

    setIsSaving(true);
    try {
      const entryRef = await addDoc(collection(db, "users", uid, "entries"), {
        title: trimmedTitle,
        mediaType,
        status,
        rating: ratingValue,
        lengthMinutes: lengthMinutesValue,
        episodeCount: episodeCountValue,
        chapterCount: chapterCountValue,
        genresThemes: tags,
        description: description.trim(),
        externalId: normalizedInitial ? String(normalizedInitial.id) : null,
        image: normalizedInitial?.image || null,
        year: normalizedInitial?.year || null,
        completedAt,
        completionDateUnknown,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (selectedListId) {
        // Map anime_movie to anime for lists compatibility
        const listMediaType = mediaType === "anime_movie" ? "anime" : mediaType;
        await addDoc(collection(db, "users", uid, "lists", selectedListId, "items"), {
          title: trimmedTitle,
          mediaType: listMediaType,
          externalId: normalizedInitial ? String(normalizedInitial.id) : entryRef.id,
          image: normalizedInitial?.image || null,
          year: normalizedInitial?.year || null,
          addedAt: serverTimestamp(),
        });
      }

      setInfo("Saved.");
      if (!normalizedInitial) {
        setTitle("");
        setRating("");
        setLengthMinutes("");
        setEpisodeCount("");
        setChapterCount("");
        setTags([]);
        setTagInput("");
        setDescription("");
        setCompletionDate("");
        setCompletionUnknown(false);
        // Do not reset selectedListId so user can add multiple items to same list?
        // Or reset it? Usually reset form means reset everything.
        setSelectedListId("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save entry.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Log entry" className="max-w-5xl bg-neutral-900/60">
      <div className="w-full">
        <form onSubmit={onSubmit} className="flex max-h-[500px] flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto pr-1 scroll-smooth">
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
                  {(["watching", "completed", "plan_to_watch", "dropped"] as EntryStatus[]).map((value) => (
                    <option key={value} value={value}>
                      {statusLabels[value]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {lists.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-neutral-400">Add to List (Optional)</div>
                <select
                  value={selectedListId}
                  onChange={(e) => setSelectedListId(e.target.value)}
                  className="w-full rounded-xl bg-neutral-800/50 border border-neutral-100/5 py-3 px-4 text-neutral-100 focus:outline-none focus:border-neutral-100/20 focus:ring-1 focus:ring-neutral-100/20 transition-all"
                >
                  <option value="">Select a list...</option>
                  {lists.map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

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
                <div className="text-xs font-medium text-neutral-400">Rating</div>
                <div className="text-xs text-neutral-500">1–10</div>
              </div>
              <input
                type="number"
                value={rating}
                onChange={(e) => setRating(e.target.value)}
                placeholder="Optional"
                inputMode="numeric"
                min={1}
                max={10}
                step={1}
                className="w-full rounded-xl bg-neutral-800/50 border border-neutral-100/5 py-3 px-4 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-neutral-100/20 focus:ring-1 focus:ring-neutral-100/20 transition-all"
              />
              {ratingError ? <div className="text-xs text-red-400">{ratingError}</div> : null}
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
                  // Allow letters, underscores, spaces, commas
                  const cleanVal = val.replace(/[^A-Za-z_,\s]/g, "");

                  if (cleanVal.includes(",")) {
                    if (tags.length >= 10) {
                      setError("Maximum of 10 tags allowed.");
                      return;
                    }
                    const parts = cleanVal.split(",");
                    const newTags = [...tags];
                    let added = false;
                    let errorMsg = null;

                    for (const part of parts) {
                      const trimmed = part.trim();
                      if (!trimmed) continue;
                      
                      // Check for duplicates (case-sensitive)
                      if (newTags.includes(trimmed)) {
                        errorMsg = `Duplicate tag: "${trimmed}"`;
                        continue;
                      }
                      
                      if (newTags.length >= 10) {
                        errorMsg = "Maximum of 10 tags allowed.";
                        break;
                      }

                      newTags.push(trimmed);
                      added = true;
                    }

                    if (errorMsg) setError(errorMsg);
                    setTags(newTags);
                    // Keep the part after the last comma as the new input, if any
                    // Actually usually comma clears the input.
                    // If user types "a,b", we add "a" and "b" and clear input.
                    // If user types "a,b,c", same.
                    // If user types "a," -> add "a", clear input.
                    // The split will give ["a", ""] for "a,".
                    // But if user types "a, b" -> ["a", " b"].
                    // We should probably clear the input completely if the comma was at the end.
                    // Or keep the partial text if it wasn't valid?
                    // Let's just clear the input if a tag was added, or set it to empty?
                    // Wait, if I type "action, hor", "action" becomes tag, "hor" remains in input?
                    // Yes, that's better UX.
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
      </div>
    </Modal>
  );
}
