"use client";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { Filter, Pencil, Trash2, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@/components/overlay/Modal";
import { DescriptionErrorWrapper } from "@/components/ui/DescriptionErrorWrapper";
import { DescriptionTextarea } from "@/components/ui/DescriptionTextarea";
import { GlassCard } from "@/components/ui/GlassCard";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import type { LoggableMedia } from "@/types/log-entry";
import { cn } from "@/utils";
import { MAX_DESCRIPTION_LENGTH } from "@/utils/validation";

type EntryMediaType = "movie" | "series" | "anime" | "manga" | "game";

type ListRow = {
  id: string;
  name: string;
  description: string;
  type: EntryMediaType;
  types: EntryMediaType[];
  updatedAt: number | null;
};

type ListItemRow = {
  id: string;
  title: string;
  mediaType: "movie" | "series" | "anime" | "manga" | "game";
  externalId: string;
  image: string | null;
  year: string | null;
  addedAt: number | null;
};

const mediaTypeLabels: Record<ListItemRow["mediaType"], string> = {
  movie: "Movie",
  series: "Series",
  anime: "Anime",
  manga: "Manga",
  game: "Game",
};

const listTypeLabels: Record<EntryMediaType, string> = {
  movie: "Movie",
  series: "Series",
  anime: "Anime",
  manga: "Manga",
  game: "Game",
};

const allMediaTypes: EntryMediaType[] = ["movie", "series", "anime", "manga", "game"];

const isEntryMediaType = (value: unknown): value is EntryMediaType =>
  value === "movie" ||
  value === "series" ||
  value === "anime" ||
  value === "manga" ||
  value === "game";

const normalizeEntryMediaTypes = (value: unknown, fallback: EntryMediaType): EntryMediaType[] => {
  if (!Array.isArray(value)) return [fallback];
  const deduped: EntryMediaType[] = [];
  for (const candidate of value) {
    if (!isEntryMediaType(candidate)) continue;
    if (!deduped.includes(candidate)) deduped.push(candidate);
  }
  return deduped.length > 0 ? deduped : [fallback];
};

const toMillis = (value: unknown) => {
  if (!value) return null;
  if (typeof value === "number") return value;
  if (
    typeof value === "object" &&
    value &&
    "toMillis" in value &&
    typeof (value as { toMillis: () => number }).toMillis === "function"
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }
  return null;
};

export function MyListsModal({
  isOpen,
  onClose,
  viewListId,
  editListId,
  deleteListId,
  initialViewListId,
  initialEditListId,
  initialDeleteListId,
}: {
  isOpen: boolean;
  onClose: () => void;
  viewListId?: string | null;
  editListId?: string | null;
  deleteListId?: string | null;
  initialViewListId?: string | null;
  initialEditListId?: string | null;
  initialDeleteListId?: string | null;
  mediaType?: EntryMediaType | null;
  initialItem?: LoggableMedia | null;
}) {
  const { user } = useAuth();
  const uid = user?.uid || null;

  const normalizedViewListId = useMemo(() => viewListId?.trim() || null, [viewListId]);
  const normalizedEditListId = useMemo(() => editListId?.trim() || null, [editListId]);
  const normalizedDeleteListId = useMemo(() => deleteListId?.trim() || null, [deleteListId]);
  const normalizedInitialViewListId = useMemo(
    () => initialViewListId?.trim() || null,
    [initialViewListId],
  );
  const normalizedInitialEditListId = useMemo(
    () => initialEditListId?.trim() || null,
    [initialEditListId],
  );
  const normalizedInitialDeleteListId = useMemo(
    () => initialDeleteListId?.trim() || null,
    [initialDeleteListId],
  );

  const activeListId = useMemo(
    () =>
      normalizedViewListId ||
      normalizedEditListId ||
      normalizedDeleteListId ||
      normalizedInitialViewListId ||
      normalizedInitialEditListId ||
      normalizedInitialDeleteListId ||
      null,
    [
      normalizedViewListId,
      normalizedEditListId,
      normalizedDeleteListId,
      normalizedInitialViewListId,
      normalizedInitialEditListId,
      normalizedInitialDeleteListId,
    ],
  );
  const openedInEditMode = useMemo(
    () => Boolean(normalizedEditListId || normalizedInitialEditListId),
    [normalizedEditListId, normalizedInitialEditListId],
  );
  const deleteModeListId = useMemo(
    () => normalizedDeleteListId || normalizedInitialDeleteListId || null,
    [normalizedDeleteListId, normalizedInitialDeleteListId],
  );

  const [list, setList] = useState<ListRow | null>(null);
  const [items, setItems] = useState<ListItemRow[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeletingList, setIsDeletingList] = useState(false);
  const [pendingDeleteListId, setPendingDeleteListId] = useState<string | null>(null);

  const [filter, setFilter] = useState<EntryMediaType | "all">("all");
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);

  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editTypes, setEditTypes] = useState<EntryMediaType[]>([]);
  const [deleteItemTarget, setDeleteItemTarget] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [isCommitConfirmOpen, setIsCommitConfirmOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setInfo(null);
    setIsEditingMetadata(openedInEditMode);
    setPendingDeleteListId(deleteModeListId);
    setFilter("all");
    setIsCommitConfirmOpen(false);
  }, [isOpen, openedInEditMode, deleteModeListId]);

  // Subscribe to the single list document
  useEffect(() => {
    if (!isOpen || !uid || !activeListId) {
      setList(null);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, "users", uid, "lists", activeListId),
      (snap) => {
        if (!snap.exists()) {
          setList(null);
          return;
        }
        const data = snap.data() as {
          name?: unknown;
          description?: unknown;
          type?: unknown;
          types?: unknown;
          updatedAt?: unknown;
        };
        const singleType = isEntryMediaType(data.type) ? data.type : "movie";
        const types = normalizeEntryMediaTypes(data.types, singleType);
        setList({
          id: snap.id,
          name: typeof data.name === "string" ? data.name : "",
          description: typeof data.description === "string" ? data.description : "",
          type: singleType,
          types,
          updatedAt: toMillis(data.updatedAt),
        });
      },
      (err) => {
        setError(err instanceof Error ? err.message : "Failed to load list.");
        setList(null);
      },
    );

    return () => unsubscribe();
  }, [isOpen, uid, activeListId]);

  // Subscribe to items
  useEffect(() => {
    if (!isOpen || !uid || !activeListId) {
      setItems([]);
      return;
    }

    const itemsQuery = query(
      collection(db, "users", uid, "lists", activeListId, "items"),
      orderBy("addedAt", "desc"),
      limit(200),
    );
    const unsubscribe = onSnapshot(
      itemsQuery,
      (snapshot) => {
        const nextItems: ListItemRow[] = snapshot.docs.map((snap) => {
          const data = snap.data() as Partial<ListItemRow> & {
            addedAt?: unknown;
          };
          const typeValue =
            data.mediaType === "movie" ||
              data.mediaType === "series" ||
              data.mediaType === "anime" ||
              data.mediaType === "manga" ||
              data.mediaType === "game"
              ? data.mediaType
              : "movie";
          return {
            id: snap.id,
            title: String(data.title || ""),
            mediaType: typeValue,
            externalId: String(data.externalId || ""),
            image: data.image ? String(data.image) : null,
            year: data.year ? String(data.year) : null,
            addedAt: toMillis(data.addedAt),
          };
        });
        setItems(nextItems);
      },
      (err) => {
        setError(err instanceof Error ? err.message : "Failed to load list items.");
        setItems([]);
      },
    );

    return () => unsubscribe();
  }, [isOpen, uid, activeListId]);

  // Sync edit fields when list loads
  useEffect(() => {
    if (!isOpen || !list) return;
    setEditName(list.name);
    setEditDescription(list.description || "");
    setEditTypes(normalizeEntryMediaTypes(list.types, list.type));
  }, [isOpen, list]);

  // Resolve pending delete target once list is loaded
  useEffect(() => {
    if (!isOpen || !pendingDeleteListId || !list) return;
    if (list.id === pendingDeleteListId) {
      setDeleteTarget({ id: list.id, name: list.name });
      setPendingDeleteListId(null);
    }
  }, [isOpen, list, pendingDeleteListId]);

  const listSupportedTypes = useMemo<EntryMediaType[]>(
    () => (list ? normalizeEntryMediaTypes(list.types, list.type) : []),
    [list],
  );
  const shouldShowViewFilters = !isEditingMetadata && listSupportedTypes.length > 1;
  const shouldShowTitleTypeBadges = !isEditingMetadata && listSupportedTypes.length === 1;

  const listItems = useMemo(() => {
    if (isEditingMetadata || filter === "all") return items;
    return items.filter((item) => item.mediaType === filter);
  }, [isEditingMetadata, items, filter]);

  const itemsPendingRemoval = useMemo(() => {
    if (!isEditingMetadata) return [];
    const allowedTypes = new Set(editTypes);
    return items.filter((item) => !allowedTypes.has(item.mediaType));
  }, [isEditingMetadata, editTypes, items]);
  const itemsPendingRemovalIds = useMemo(
    () => new Set(itemsPendingRemoval.map((item) => item.id)),
    [itemsPendingRemoval],
  );
  const itemsPendingRemovalTypes = useMemo(() => {
    const unique: EntryMediaType[] = [];
    for (const item of itemsPendingRemoval) {
      if (!unique.includes(item.mediaType)) unique.push(item.mediaType);
    }
    return unique;
  }, [itemsPendingRemoval]);

  useEffect(() => {
    if (!isOpen || isEditingMetadata) return;
    if (filter === "all") return;
    if (listSupportedTypes.includes(filter)) return;
    setFilter("all");
  }, [isOpen, isEditingMetadata, filter, listSupportedTypes]);

  useEffect(() => {
    if (isEditingMetadata) return;
    setIsCommitConfirmOpen(false);
  }, [isEditingMetadata]);

  const deleteList = async (mode: "keep" | "delete") => {
    if (!uid || !deleteTarget) return;
    setError(null);
    setInfo(null);
    setIsDeletingList(true);
    try {
      const listId = deleteTarget.id;
      const itemsSnap = await getDocs(collection(db, "users", uid, "lists", listId, "items"));
      let batch = writeBatch(db);
      let opCount = 0;
      const commitBatch = async () => {
        if (opCount === 0) return;
        await batch.commit();
        batch = writeBatch(db);
        opCount = 0;
      };
      for (const itemDoc of itemsSnap.docs) {
        const data = itemDoc.data() as { externalId?: unknown };
        if (mode === "delete" && typeof data.externalId === "string" && data.externalId) {
          batch.delete(doc(db, "users", uid, "entries", data.externalId));
          opCount += 1;
          if (opCount >= 400) await commitBatch();
        }
        batch.delete(itemDoc.ref);
        opCount += 1;
        if (opCount >= 400) await commitBatch();
      }
      batch.delete(doc(db, "users", uid, "lists", listId));
      opCount += 1;
      await commitBatch();
      setDeleteTarget(null);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete list.");
    } finally {
      setIsDeletingList(false);
    }
  };

  const validateListEdits = () => {
    const name = editName.trim();
    if (!name) {
      setError("List name is required.");
      return null;
    }
    if (name.length > 80) {
      setError("List name cannot exceed 80 characters.");
      return null;
    }
    const descriptionValue = editDescription.trim();
    if (descriptionValue.length > 250) {
      setError("Description cannot exceed 250 characters.");
      return null;
    }
    if (editTypes.length === 0) {
      setError("Select at least one category.");
      return null;
    }
    return { name, descriptionValue };
  };

  const openCommitConfirmation = () => {
    if (!uid || !activeListId) return;
    setError(null);
    setInfo(null);
    const validation = validateListEdits();
    if (!validation) return;
    setIsCommitConfirmOpen(true);
  };

  const saveListEdits = async () => {
    if (!uid || !activeListId) return;
    const validation = validateListEdits();
    if (!validation) return;
    const { name, descriptionValue } = validation;
    setError(null);
    setInfo(null);

    setIsSaving(true);
    try {
      const nameQuery = query(
        collection(db, "users", uid, "lists"),
        where("name", "==", name),
        limit(3),
      );
      const nameSnapshot = await getDocs(nameQuery);
      const hasDuplicate = nameSnapshot.docs.some((docSnap) => docSnap.id !== activeListId);
      if (hasDuplicate) {
        setError("A list with this name already exists.");
        setIsSaving(false);
        return;
      }

      if (itemsPendingRemoval.length > 0) {
        const batch = writeBatch(db);
        for (const item of itemsPendingRemoval) {
          batch.delete(doc(db, "users", uid, "lists", activeListId, "items", item.id));
        }
        batch.update(doc(db, "users", uid, "lists", activeListId), {
          name,
          description: descriptionValue,
          type: editTypes[0],
          types: editTypes,
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
      } else {
        await updateDoc(doc(db, "users", uid, "lists", activeListId), {
          name,
          description: descriptionValue,
          type: editTypes[0],
          types: editTypes,
          updatedAt: serverTimestamp(),
        });
      }

      setInfo(
        itemsPendingRemoval.length > 0
          ? `List updated. Removed ${itemsPendingRemoval.length} item${itemsPendingRemoval.length === 1 ? "" : "s"} from deselected categories.`
          : "List updated.",
      );
      setIsCommitConfirmOpen(false);
      setIsEditingMetadata(false);
      if (openedInEditMode) onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update list.");
    } finally {
      setIsSaving(false);
    }
  };

  const removeItem = (itemId: string, title: string) => {
    setDeleteItemTarget({ id: itemId, title });
  };

  const confirmRemoveItem = async () => {
    if (!uid || !activeListId || !deleteItemTarget) return;
    setError(null);
    setInfo(null);
    setIsSaving(true);
    try {
      await deleteDoc(doc(db, "users", uid, "lists", activeListId, "items", deleteItemTarget.id));
      await updateDoc(doc(db, "users", uid, "lists", activeListId), {
        updatedAt: serverTimestamp(),
      });
      setDeleteItemTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove item.");
    } finally {
      setIsSaving(false);
    }
  };

  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      hideHeader
      containerClassName="max-w-[95vw] xl:max-w-7xl"
      className="p-0 overflow-hidden"
    >
      <div className="flex flex-col h-[85vh]">
        {/* Header */}
        <div className="relative shrink-0 p-4 border-b border-white/5 space-y-6">
          <div className="absolute inset-0 pointer-events-none" />

          <div className="relative flex items-start justify-between gap-10">
            <div className="flex-1 min-w-0">
              {isEditingMetadata ? (
                <div className="flex flex-col max-w-4xl gap-5">
                  <div className="space-y-2">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="List name"
                      className="w-full bg-transparent text-2xl font-bold text-white placeholder-neutral-700 focus:outline-none border-b border-white/10 focus:border-white/30 transition-all pb-4"
                      ref={inputRef}
                    />
                    <DescriptionTextarea
                      value={editDescription}
                      onValueChange={setEditDescription}
                      placeholder="Add a description..."
                      className="w-full bg-transparent text-base text-neutral-400 placeholder-neutral-700 focus:outline-none focus:text-neutral-200 border-none px-0 py-0"
                      rows={2}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {allMediaTypes.map((type) => (
                      <button
                        type="button"
                        key={type}
                        onClick={() => {
                          setEditTypes((prev) => {
                            if (prev.includes(type)) {
                              if (prev.length === 1) return prev;
                              return prev.filter((t) => t !== type);
                            }
                            return [...prev, type];
                          });
                        }}
                        className={cn(
                          "px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all duration-300",
                          editTypes.includes(type)
                            ? "bg-green-500/10 border-green-500/80 text-white shadow-lg shadow-green-500/5"
                            : "bg-black/20 border-white/5 text-neutral-400 hover:text-neutral-200 hover:border-white/10",
                        )}
                      >
                        {listTypeLabels[type]}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <DescriptionErrorWrapper
                  isInvalid={
                    !!list?.description && list.description.length > MAX_DESCRIPTION_LENGTH
                  }
                >
                  <div className="space-y-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-4xl lg:text-5xl font-bold text-white tracking-tight truncate drop-shadow-sm">
                          {list?.name || "Untitled List"}
                        </h2>
                        {shouldShowTitleTypeBadges &&
                          listSupportedTypes.map((type) => (
                            <span
                              key={`title-type-${type}`}
                              className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-300"
                            >
                              {listTypeLabels[type]}
                            </span>
                          ))}
                      </div>
                    </div>
                    {list?.description && (
                      <p className="max-w-4xl text-lg text-neutral-400 leading-relaxed font-medium">
                        {list.description}
                      </p>
                    )}
                  </div>
                </DescriptionErrorWrapper>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {!isEditingMetadata && (
                <button
                  type="button"
                  onClick={() => setIsEditingMetadata(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-neutral-900/40 p-4 text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-300 transition-colors hover:border-white/20 hover:bg-neutral-900/70 hover:text-white"
                  aria-label="Edit list details"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => list && setDeleteTarget({ id: list.id, name: list.name })}
                className="inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/5 p-4 text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-300 transition-colors hover:bg-red-500/10 hover:text-red-300"
                aria-label="Delete list"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="ml-1 p-1 text-neutral-400 transition-colors hover:text-white"
                aria-label="Close"
              >
                <X className="h-7 w-7" />
              </button>
            </div>
          </div>

          {/* Type Filters */}
          {shouldShowViewFilters && (
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={cn(
                  "px-8 py-2 rounded-2xl text-[10px] font-bold uppercase transition-all border",
                  filter === "all"
                    ? "bg-white text-black border-white shadow-2xl shadow-white/10"
                    : "bg-black/20 border-white/5 text-neutral-500 hover:bg-white/5 hover:text-neutral-300",
                )}
              >
                All
              </button>
              {listSupportedTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFilter(type)}
                  className={cn(
                    "px-8 py-2 rounded-2xl text-[10px] font-bold uppercase transition-all border",
                    filter === type
                      ? "bg-white text-black border-white shadow-2xl shadow-white/10"
                      : "bg-black/20 border-white/5 text-neutral-500 hover:bg-white/5 hover:text-neutral-300",
                  )}
                >
                  {listTypeLabels[type]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Grid Content */}
        <div className="flex-1 overflow-y-auto p-10 pt-8 custom-scrollbar bg-neutral-900/40">
          {error && (
            <div className="mb-8 px-8 py-5 rounded-3xl bg-red-500/10 border border-red-500/20 text-xs font-bold uppercase tracking-widest text-red-200 backdrop-blur-md">
              {error}
            </div>
          )}
          {info && (
            <div className="mb-8 px-8 py-5 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold uppercase tracking-widest text-emerald-200 backdrop-blur-md">
              {info}
            </div>
          )}

          {listItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[50vh] text-neutral-600 gap-8">
              <div className="w-24 h-24 rounded-[2.5rem] bg-white/5 flex items-center justify-center border border-white/5 shadow-inner">
                <Filter size={40} className="opacity-20" />
              </div>
              <div className="text-center space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.3em]">No entries added</p>
                <p className="text-xs text-neutral-700 uppercase tracking-widest">
                  {shouldShowViewFilters
                    ? "Select a different filter or add items to this list"
                    : "Add items to this list"}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-1">
              {listItems.map((item) => (
                <div key={item.id} className="group relative">
                  {isEditingMetadata && itemsPendingRemovalIds.has(item.id) && (
                    <div className="pointer-events-none absolute inset-0 z-40 rounded-4xl">
                      <div className="absolute inset-0 bg-red-500/15 rounded-4xl" />
                      <div className="absolute left-[-18%] top-1/2 h-1.25 w-[140%] -translate-y-1/2 rotate-45 bg-red-500/90 shadow-[0_0_28px_rgba(239,68,68,0.55)]" />
                      <div className="absolute left-[-18%] top-1/2 h-1.25 w-[140%] -translate-y-1/2 -rotate-45 bg-red-500/90 shadow-[0_0_28px_rgba(239,68,68,0.55)]" />
                      <div className="absolute bottom-4 left-4 rounded-lg border border-red-400/40 bg-black/70 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-red-200">
                        Removed on commit
                      </div>
                    </div>
                  )}
                  <GlassCard
                    className="aspect-3/4 p-0 border-white/5 overflow-hidden transition-all duration-700 group-hover:border-white/20 group-hover:shadow-[0_0_50px_-12px_rgba(0,0,0,0.8)]"
                    hoverEffect
                  >
                    {item.image ? (
                      <>
                        <div className="absolute inset-0 animate-pulse bg-neutral-800/60" />
                        <Image
                          src={item.image}
                          alt={item.title}
                          width={500}
                          height={750}
                          className="relative w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                        />
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-900 text-neutral-800 gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center">
                          <Filter size={20} className="opacity-10" />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-30 text-center px-4">
                          Artwork Unavailable
                        </span>
                      </div>
                    )}

                    <div className="absolute inset-x-0 top-0 h-32 bg-linear-to-b from-black/60 to-transparent opacity-40 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="absolute inset-x-0 bottom-0 h-48 bg-linear-to-t from-black via-black/60 to-transparent opacity-80 group-hover:opacity-100 transition-opacity duration-500" />

                    <div className="absolute inset-0 p-6 flex flex-col justify-end gap-3 z-20">
                      <div className="flex flex-col gap-4 transform transition-transform duration-500 group-hover:-translate-y-2">
                        <span className="inline-block w-min px-2 py-0.5 rounded-md bg-white/25 border border-white/5 text-[9px] font-bold text-white uppercase tracking-[0.2em]">
                          {mediaTypeLabels[item.mediaType]}
                        </span>
                        <h3 className="text-lg font-bold text-white leading-tight line-clamp-2 drop-shadow-lg">
                          {item.title}
                        </h3>
                      </div>
                    </div>

                    <div className="absolute top-4 right-4 z-30">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeItem(item.id, item.title);
                        }}
                        className="p-3 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 text-white/40 hover:text-red-400 hover:bg-red-500/20 hover:border-red-500/30 transition-all duration-300 shadow-xl opacity-0 group-hover:opacity-100 -translate-y-2.5 group-hover:translate-y-0"
                        title="Remove from list"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </GlassCard>
                </div>
              ))}
            </div>
          )}
        </div>

        {isEditingMetadata && (
          <div className="shrink-0 p-5 border-t border-white/5 bg-neutral-900/60 backdrop-blur-xl flex items-center justify-end gap-4">
            <button
              type="button"
              onClick={() => {
                setIsEditingMetadata(false);
                setEditName(list?.name || "");
                setEditDescription(list?.description || "");
                setEditTypes(normalizeEntryMediaTypes(list?.types, list?.type || "movie"));
                setIsCommitConfirmOpen(false);
              }}
              disabled={isSaving}
              className="px-4 py-2 rounded-3xl text-neutral-400 text-[12px] font-bold uppercase tracking-[0.2em] hover:text-white transition-all hover:bg-white/5"
            >
              Discard Changes
            </button>
            <button
              type="button"
              onClick={openCommitConfirmation}
              disabled={isSaving}
              className="px-4 py-2 rounded-3xl bg-white text-black text-[12px] font-bold uppercase tracking-[0.2em] hover:bg-neutral-200 transition-all disabled:opacity-50 shadow-[0_0_30px_rgba(255,255,255,0.1)] active:scale-95"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        )}
      </div>

      {/* Commit Confirmation Modal */}
      <Modal
        isOpen={isCommitConfirmOpen}
        onClose={() => setIsCommitConfirmOpen(false)}
        title="Commit changes"
        className="max-w-md bg-neutral-900 border border-white/5"
      >
        <div className="space-y-5 text-sm text-neutral-300">
          <div className="rounded-lg border border-amber-400/20 bg-amber-500/10 p-4 text-amber-100">
            Are you sure you want to commit these changes? These changes are permanent.
          </div>
          {itemsPendingRemoval.length > 0 && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-red-200">
              <div>
                {itemsPendingRemoval.length} item
                {itemsPendingRemoval.length === 1 ? "" : "s"} will be removed from this list.
              </div>
              <div className="mt-1 text-xs uppercase tracking-wider text-red-200/80">
                Categories:{" "}
                {itemsPendingRemovalTypes.map((type) => listTypeLabels[type]).join(", ")}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsCommitConfirmOpen(false)}
              disabled={isSaving}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-neutral-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveListEdits}
              disabled={isSaving}
              className="px-4 py-2 rounded-lg bg-red-500 text-xs font-semibold text-white hover:bg-red-600 transition-colors disabled:opacity-70"
            >
              {isSaving ? "Saving..." : "Commit Permanently"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete List Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete list"
        className="max-w-md bg-neutral-900 border border-white/5"
      >
        <div className="space-y-4 text-sm text-neutral-300">
          <div className="p-4 rounded-lg bg-red-500/5 border border-red-500/10 text-red-200">
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>?
            <br />
            This action cannot be undone.
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end mt-6">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeletingList}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-neutral-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => deleteList("keep")}
              disabled={isDeletingList}
              className={cn(
                "rounded-lg border border-white/10 bg-neutral-800/50 px-4 py-2 text-xs font-semibold text-neutral-200 transition-colors hover:bg-neutral-800",
                isDeletingList ? "cursor-not-allowed opacity-70" : "",
              )}
            >
              Delete List Only
            </button>
            <button
              type="button"
              onClick={() => deleteList("delete")}
              disabled={isDeletingList}
              className={cn(
                "rounded-lg bg-red-500 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-600",
                isDeletingList ? "cursor-not-allowed opacity-70" : "",
              )}
            >
              Delete List & Items
            </button>
          </div>
        </div>
      </Modal>

      {/* Remove Item Confirmation Modal */}
      <Modal
        isOpen={!!deleteItemTarget}
        onClose={() => setDeleteItemTarget(null)}
        title="Remove item"
        className="max-w-md bg-neutral-900 border border-white/5"
      >
        <div className="space-y-6">
          <div className="text-sm text-neutral-300">
            Remove <strong>{deleteItemTarget?.title}</strong> from this list?
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setDeleteItemTarget(null)}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-neutral-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmRemoveItem}
              disabled={isSaving}
              className="px-4 py-2 rounded-lg bg-red-500 text-xs font-semibold text-white hover:bg-red-600 transition-colors"
            >
              {isSaving ? "Removing..." : "Remove"}
            </button>
          </div>
        </div>
      </Modal>
    </Modal>
  );
}
