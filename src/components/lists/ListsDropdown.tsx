"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { collection, onSnapshot, orderBy, query, limit } from "firebase/firestore";
import { ListPlus, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import { ImageWithSkeleton } from "@/components/ui/ImageWithSkeleton";

type EntryMediaType = "movie" | "series" | "anime" | "manga" | "game";

type ListRow = {
  id: string;
  name: string;
  description: string;
  type: EntryMediaType;
  types: EntryMediaType[];
};

type ListStats = {
  count: number;
  images: string[];
};

interface ListsDropdownProps {
  className?: string;
  onCreateList: () => void;
  onOpenList: (listId: string) => void;
  onEditList: (listId: string, type: EntryMediaType) => void;
  onDeleteList: (listId: string, type: EntryMediaType) => void;
}

const mediaTypeLabels: Record<EntryMediaType, string> = {
  movie: "Movie",
  series: "Series",
  anime: "Anime",
  manga: "Manga",
  game: "Game",
};

const coerceType = (value: unknown): EntryMediaType => {
  if (value === "movie" || value === "series" || value === "anime" || value === "manga" || value === "game") {
    return value;
  }
  return "movie";
};

export function ListsDropdown({ className, onCreateList, onOpenList, onEditList, onDeleteList }: ListsDropdownProps) {
  const { user } = useAuth();
  const uid = user?.uid || null;

  const [isOpen, setIsOpen] = useState(false);
  const [lists, setLists] = useState<ListRow[]>([]);
  const [listStats, setListStats] = useState<Record<string, ListStats>>({});
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemUnsubsRef = useRef<Map<string, () => void>>(new Map());

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!containerRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    if (!isOpen || !uid) {
      itemUnsubsRef.current.forEach((unsubscribe) => unsubscribe());
      itemUnsubsRef.current.clear();
      return;
    }

    const itemUnsubs = itemUnsubsRef.current;
    const listsQuery = query(
      collection(db, "users", uid, "lists"),
      orderBy("updatedAt", "desc"),
      limit(50)
    );

    const unsubscribeLists = onSnapshot(
      listsQuery,
      (snapshot) => {
        const nextLists: ListRow[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as { type?: unknown; types?: unknown; name?: unknown; description?: unknown };
          const fallbackType = coerceType(data.type);
          const nextTypes = Array.isArray(data.types) ? data.types.map(coerceType) : [fallbackType];
          return {
            id: docSnap.id,
            name: typeof data.name === "string" ? data.name : "Untitled list",
            description: typeof data.description === "string" ? data.description : "",
            type: fallbackType,
            types: nextTypes,
          };
        });

        const activeIds = new Set(nextLists.map((list) => list.id));

        itemUnsubs.forEach((unsubscribe, id) => {
          if (!activeIds.has(id)) {
            unsubscribe();
            itemUnsubs.delete(id);
            setListStats((current) => {
              const next = { ...current };
              delete next[id];
              return next;
            });
          }
        });

        nextLists.forEach((list) => {
          if (itemUnsubs.has(list.id)) return;

          const itemsQuery = query(
            collection(db, "users", uid, "lists", list.id, "items"),
            orderBy("addedAt", "desc")
          );

          const unsubscribeItems = onSnapshot(itemsQuery, (itemSnapshot) => {
            const images = itemSnapshot.docs
              .map((itemDoc) => {
                const data = itemDoc.data() as { image?: unknown };
                return typeof data.image === "string" ? data.image : null;
              })
              .filter((image): image is string => Boolean(image))
              .slice(0, 5);

            setListStats((current) => ({
              ...current,
              [list.id]: {
                count: itemSnapshot.size,
                images,
              },
            }));
          });

          itemUnsubs.set(list.id, unsubscribeItems);
        });

        setLists(nextLists);
        setError(null);
      },
      (nextError) => {
        setError(nextError instanceof Error ? nextError.message : "Failed to load lists.");
      }
    );

    return () => {
      unsubscribeLists();
      itemUnsubs.forEach((unsubscribe) => unsubscribe());
      itemUnsubs.clear();
    };
  }, [isOpen, uid]);

  return (
    <div ref={containerRef} className={cn("relative z-40", className)}>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="rounded-full border border-white/10 bg-neutral-900/40 px-4 py-2 text-xs font-semibold text-neutral-200 transition-colors hover:bg-neutral-900/60"
      >
        Lists
      </button>

      <AnimatePresence>
        {isOpen ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute right-0 top-[calc(100%+10px)] w-[min(95vw,760px)] overflow-hidden rounded-2xl border border-white/10 bg-neutral-950/95 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl"
          >
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-white">My Lists</div>
                <div className="text-xs text-neutral-500">Browse and manage your list collections.</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onCreateList();
                  setIsOpen(false);
                }}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-neutral-900/70 px-3 py-1.5 text-xs font-semibold text-neutral-200 transition-colors hover:bg-neutral-800"
              >
                <ListPlus size={13} suppressHydrationWarning />
                New List
              </button>
            </div>

            <div className="max-h-[62vh] overflow-y-auto p-4 custom-scrollbar">
              {error ? <div className="mb-3 text-sm text-red-400">{error}</div> : null}

              {lists.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-neutral-900/40 p-6 text-center text-sm text-neutral-500">
                  No lists yet. Create one to get started.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {lists.map((list) => {
                    const stats = listStats[list.id] || { count: 0, images: [] };

                    return (
                      <div
                        key={list.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          onOpenList(list.id);
                          setIsOpen(false);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onOpenList(list.id);
                            setIsOpen(false);
                          }
                        }}
                        className="group flex h-full cursor-pointer flex-col gap-3 rounded-2xl border border-white/10 bg-neutral-900/50 p-4 text-left transition-colors hover:bg-neutral-900/70"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-white">{list.name}</div>
                            <div className="mt-1 text-[11px] text-neutral-500">
                              {stats.count} item{stats.count === 1 ? "" : "s"}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                onEditList(list.id, list.type);
                                setIsOpen(false);
                              }}
                              className="rounded-lg p-2.5 text-neutral-500 transition-colors hover:bg-white/5 hover:text-white"
                              aria-label="Edit list"
                            >
                              <Pencil size={16} suppressHydrationWarning />
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                onDeleteList(list.id, list.type);
                                setIsOpen(false);
                              }}
                              className="rounded-lg p-2.5 text-neutral-500 transition-colors hover:bg-red-500/10 hover:text-red-300"
                              aria-label="Delete list"
                            >
                              <Trash2 size={16} suppressHydrationWarning />
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {list.types.map((type) => (
                            <span
                              key={`${list.id}-${type}`}
                              className="rounded-full border border-white/10 bg-neutral-900/70 px-2 py-0.5 text-[10px] font-semibold text-neutral-300"
                            >
                              {mediaTypeLabels[type]}
                            </span>
                          ))}
                        </div>

                        <div className="line-clamp-2 min-h-8 text-xs text-neutral-500">
                          {list.description || "No description"}
                        </div>

                        <div className="mt-auto flex items-center justify-between gap-3">
                          <div className="flex -space-x-2">
                            {stats.images.length > 0 ? (
                              stats.images.map((image, index) => (
                                <div
                                  key={`${list.id}-image-${index}`}
                                  className="relative h-8 w-8 overflow-hidden rounded-full border border-neutral-950 bg-neutral-800"
                                >
                                  <ImageWithSkeleton src={image} alt="" fill className="object-cover" />
                                </div>
                              ))
                            ) : (
                              <div className="h-8 w-8 rounded-full border border-dashed border-white/20 bg-neutral-900/70" />
                            )}
                          </div>
                          <span className="text-[11px] text-neutral-500">View list</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

