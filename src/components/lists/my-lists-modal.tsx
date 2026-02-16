"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
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
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/ui/glass-card";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/auth-context";
import type { LoggableMedia } from "@/components/entry/log-entry-modal";
import { NewListModal } from "@/components/lists/new-list-modal";
import {
  Pencil,
  X,
  Trash2,
  Globe,
  Filter
} from "lucide-react";

type EntryMediaType = "movie" | "series" | "anime" | "manga" | "game";

type ListRow = {
  id: string;
  name: string;
  description: string;
  type: EntryMediaType;
  types: EntryMediaType[];
  updatedAt: number | null;
  createdAt: number | null;
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
  initialItem,
  mediaType,
  startCreating = false,
  initialViewListId,
  initialEditListId,
  initialDeleteListId,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialItem?: LoggableMedia | null;
  mediaType?: EntryMediaType | null;
  startCreating?: boolean;
  initialViewListId?: string | null;
  initialEditListId?: string | null;
  initialDeleteListId?: string | null;
}) {
  const { user } = useAuth();
  const uid = user?.uid || null;

  const [lists, setLists] = useState<ListRow[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [viewingListId, setViewingListId] = useState<string | null>(null);
  const [items, setItems] = useState<ListItemRow[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCheckingItem, setIsCheckingItem] = useState(false);
  const [isItemAlreadyInList, setIsItemAlreadyInList] = useState(false);


  const [isNewListOpen, setIsNewListOpen] = useState(startCreating);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [isDeletingList, setIsDeletingList] = useState(false);
  const [pendingDeleteListId, setPendingDeleteListId] = useState<string | null>(null);

  // New state for redesign
  const [filter, setFilter] = useState<EntryMediaType | "all">("all");
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);

  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editTypes, setEditTypes] = useState<EntryMediaType[]>([]);
  const [deleteItemTarget, setDeleteItemTarget] = useState<{ id: string; title: string } | null>(null);

  const pendingItem = useMemo(() => initialItem || null, [initialItem]);
  const pendingListType = useMemo<EntryMediaType | null>(() => {
    if (!pendingItem) return null;
    return pendingItem.type === "anime_movie" ? "anime" : pendingItem.type;
  }, [pendingItem]);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setInfo(null);
    const targetListId = initialEditListId || initialDeleteListId || initialViewListId || null;
    setViewingListId(targetListId);
    setIsNewListOpen(startCreating);
    setIsEditingMetadata(Boolean(initialEditListId));
    setPendingDeleteListId(initialDeleteListId || null);
  }, [isOpen, startCreating, initialDeleteListId, initialEditListId, initialViewListId]);

  useEffect(() => {
    if (!isOpen) return;
    if (!uid) {
      setLists([]);
      setSelectedListId(null);
      return;
    }

    const listsQuery = query(
      collection(db, "users", uid, "lists"),
      orderBy("updatedAt", "desc"),
      limit(50),
    );
    const unsubscribe = onSnapshot(
      listsQuery,
      (snapshot) => {
        const nextLists: ListRow[] = snapshot.docs.map((snap) => {
          const data = snap.data() as {
            name?: unknown;
            description?: unknown;
            type?: unknown;
            types?: unknown;
            updatedAt?: unknown;
            createdAt?: unknown;
          };
          const singleType = (data.type as EntryMediaType) || "movie";
          const types = Array.isArray(data.types) ? (data.types as EntryMediaType[]) : [singleType];
          return {
            id: snap.id,
            name: typeof data.name === "string" ? data.name : "",
            description:
              typeof data.description === "string" ? data.description : "",
            type: singleType,
            types,
            updatedAt: toMillis(data.updatedAt),
            createdAt: toMillis(data.createdAt),
          };
        });

        // Filter lists by media type if specified
        const filteredLists = mediaType ? nextLists.filter(list => list.types.includes(mediaType)) : nextLists;
        setLists(filteredLists);
        // Default selected to first list for the dropdown
        if (!selectedListId && filteredLists.length > 0) {
          setSelectedListId(filteredLists[0].id);
        }
        if (selectedListId && !filteredLists.some((l) => l.id === selectedListId)) {
          setSelectedListId(filteredLists.length > 0 ? filteredLists[0].id : null);
        }
      },
      (err) => {
        const message =
          err instanceof Error ? err.message : "Failed to load lists.";
        setError(message);
        setLists([]);
        setSelectedListId(null);
      },
    );

    return () => unsubscribe();
  }, [isOpen, uid, mediaType]);

  useEffect(() => {
    if (!isOpen) return;
    // Only fetch items if we are VIEWING a list
    if (!uid || !viewingListId) {
      setItems([]);
      return;
    }

    const itemsQuery = query(
      collection(db, "users", uid, "lists", viewingListId, "items"),
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
        const message =
          err instanceof Error ? err.message : "Failed to load list items.";
        setError(message);
        setItems([]);
      },
    );

    return () => unsubscribe();
  }, [isOpen, uid, viewingListId]);

  const viewingList = useMemo(
    () => lists.find((l) => l.id === viewingListId) || null,
    [lists, viewingListId],
  );
  const selectedList = useMemo(
    () => lists.find((l) => l.id === selectedListId) || null,
    [lists, selectedListId],
  );

  useEffect(() => {
    if (!isOpen || !pendingDeleteListId) return;
    const list = lists.find((entry) => entry.id === pendingDeleteListId);
    if (list) {
      setDeleteTarget({ id: list.id, name: list.name });
      setPendingDeleteListId(null);
    }
  }, [isOpen, lists, pendingDeleteListId]);



  useEffect(() => {
    if (!viewingListId) {
      setIsEditingMetadata(false);
      setDeleteItemTarget(null);
      setFilter("all");
    }
  }, [viewingListId]);

  useEffect(() => {
    if (!isOpen || !viewingList) return;
    setEditName(viewingList.name);
    setEditDescription(viewingList.description || "");
    setEditTypes(viewingList.types);
  }, [isOpen, viewingList]);

  useEffect(() => {
    if (!isOpen || !uid || !selectedListId || !pendingItem) {
      setIsItemAlreadyInList(false);
      setIsCheckingItem(false);
      return;
    }
    setIsCheckingItem(true);
    const externalId = String(pendingItem.id);
    const itemsQuery = query(
      collection(db, "users", uid, "lists", selectedListId, "items"),
      where("externalId", "==", externalId),
      limit(1),
    );
    const unsubscribe = onSnapshot(
      itemsQuery,
      (snapshot) => {
        setIsItemAlreadyInList(!snapshot.empty);
        setIsCheckingItem(false);
      },
      () => {
        setIsItemAlreadyInList(false);
        setIsCheckingItem(false);
      },
    );
    return () => unsubscribe();
  }, [isOpen, uid, selectedListId, pendingItem]);

  const handleListCreated = (list: { id: string; name: string; type: EntryMediaType; types: EntryMediaType[]; description: string }) => {
    setInfo("List created.");
    setSelectedListId(list.id);
  };

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
      setInfo("List deleted.");
      setViewingListId(null);
      setDeleteTarget(null);
      if (initialDeleteListId) onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete list.");
    } finally {
      setIsDeletingList(false);
    }
  };



  const saveListEdits = async () => {
    if (!uid || !viewingListId) return;
    setError(null);
    setInfo(null);
    const name = editName.trim();
    if (!name) {
      setError("List name is required.");
      return;
    }
    if (name.length > 80) {
      setError("List name cannot exceed 80 characters.");
      return;
    }
    const descriptionValue = editDescription.trim();
    if (descriptionValue.length > 250) {
      setError("Description cannot exceed 250 characters.");
      return;
    }
    if (editTypes.length === 0) {
      setError("Select at least one category.");
      return;
    }

    setIsSaving(true);
    try {
      const nameQuery = query(
        collection(db, "users", uid, "lists"),
        where("name", "==", name),
        limit(3),
      );
      const nameSnapshot = await getDocs(nameQuery);
      const hasDuplicate = nameSnapshot.docs.some((docSnap) => docSnap.id !== viewingListId);
      if (hasDuplicate) {
        setError("A list with this name already exists.");
        setIsSaving(false);
        return;
      }
      await updateDoc(doc(db, "users", uid, "lists", viewingListId), {
        name,
        description: descriptionValue,
        type: editTypes[0],
        types: editTypes,
        updatedAt: serverTimestamp(),
      });

      setInfo("List updated.");
      setIsEditingMetadata(false);
      if (initialEditListId) onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update list.");
    } finally {
      setIsSaving(false);
    }
  };

  const addPendingToSelected = async () => {
    if (!uid || !selectedListId || !pendingItem) return;
    setError(null);
    setInfo(null);
    if (!selectedList) {
      setError("Select a valid list.");
      return;
    }
    if (!pendingListType) {
      setError("Select an item type to continue.");
      return;
    }
    if (!selectedList.types.includes(pendingListType)) {
      setError(`This list only accepts ${selectedList.types.map((t) => listTypeLabels[t]).join(", ")} items.`);
      return;
    }
    if (isItemAlreadyInList) {
      setError("This item is already in the selected list.");
      return;
    }

    setIsSaving(true);
    try {
      await addDoc(
        collection(db, "users", uid, "lists", selectedListId, "items"),
        {
          title: pendingItem.title,
          externalId: String(pendingItem.id),
          image: pendingItem.image || null,
          year: pendingItem.year || null,
          mediaType: pendingListType,
          addedAt: serverTimestamp(),
        },
      );
      await updateDoc(doc(db, "users", uid, "lists", selectedListId), {
        updatedAt: serverTimestamp(),
      });
      setInfo("Added to list.");
      onClose(); // Close modal after adding
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add item.");
    } finally {
      setIsSaving(false);
    }
  };

  const removeItem = (itemId: string, title: string) => {
    setDeleteItemTarget({ id: itemId, title });
  };

  const confirmRemoveItem = async () => {
    if (!uid || !viewingListId || !deleteItemTarget) return;
    setError(null);
    setInfo(null);
    setIsSaving(true);
    try {
      await deleteDoc(
        doc(db, "users", uid, "lists", viewingListId, "items", deleteItemTarget.id),
      );
      await updateDoc(doc(db, "users", uid, "lists", viewingListId), {
        updatedAt: serverTimestamp(),
      });
      setDeleteItemTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove item.");
    } finally {
      setIsSaving(false);
    }
  };

  if (viewingListId) {
    const listItems = items.filter((item) => {
      if (filter === "all") return true;
      return item.mediaType === filter;
    });

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
            {/* Background Accent Gradient */}
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
                        autoFocus
                      />
                      <input
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="Add a description..."
                        className="w-full bg-transparent text-base text-neutral-400 placeholder-neutral-700 focus:outline-none focus:text-neutral-200"
                      />
                    </div>

                    {/* Category Filter */}
                    <div className="flex flex-wrap gap-2">
                      {(["movie", "series", "anime", "manga", "game"] as EntryMediaType[]).map((type) => (
                        <button
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
                              : "bg-black/20 border-white/5 text-neutral-400 hover:text-neutral-200 hover:border-white/10"
                          )}
                        >
                          {listTypeLabels[type]}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <h2 className="text-4xl lg:text-5xl font-bold text-white tracking-tight truncate drop-shadow-sm">
                      {viewingList?.name || "Untitled List"}
                    </h2>
                    <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-[0.2em] text-neutral-500">
                      <span className="text-neutral-300">Created by {user?.displayName || "User"}</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-neutral-700" />
                      <span>{viewingList?.updatedAt ? new Date(viewingList.updatedAt).toLocaleDateString() : "Just now"}</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-neutral-700" />
                      <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 text-neutral-300 border border-white/5 backdrop-blur-md">
                        <Globe size={12} className="text-neutral-400" />
                        Public List
                      </span>
                    </div>
                    {viewingList?.description && (
                      <p className="max-w-4xl text-lg text-neutral-400 leading-relaxed font-medium">
                        {viewingList.description}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {!isEditingMetadata && (
                  <button
                    onClick={() => setIsEditingMetadata(true)}
                    className="p-4 rounded-3xl bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10 transition-all border border-white/5 shadow-xl"
                    aria-label="Edit list details"
                  >
                    <Pencil className="w-5 h-5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => viewingList && setDeleteTarget({ id: viewingList.id, name: viewingList.name })}
                  className="p-4 rounded-3xl bg-red-400/5 text-neutral-400 hover:text-red-400 hover:bg-red-400/10 transition-all border border-white/5 shadow-xl"
                  aria-label="Delete list"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <div className="w-px h-8 bg-white/10 mx-2" />
                <button
                  onClick={() => setViewingListId(null)}
                  className="p-4 rounded-3xl bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10 transition-all border border-white/5 shadow-xl"
                  aria-label="Close"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Type Filters */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setFilter("all")}
                className={cn(
                  "px-8 py-2 rounded-2xl text-[10px] font-bold uppercase transition-all border",
                  filter === "all"
                    ? "bg-white text-black border-white shadow-2xl shadow-white/10"
                    : "bg-black/20 border-white/5 text-neutral-500 hover:bg-white/5 hover:text-neutral-300"
                )}
              >
                All
              </button>
              {(["movie", "series", "anime", "game"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setFilter(type)}
                  className={cn(
                    "px-8 py-2 rounded-2xl text-[10px] font-bold uppercase transition-all border",
                    filter === type
                      ? "bg-white text-black border-white shadow-2xl shadow-white/10"
                      : "bg-black/20 border-white/5 text-neutral-500 hover:bg-white/5 hover:text-neutral-300"
                  )}
                >
                  {listTypeLabels[type]}
                </button>
              ))}
            </div>
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
                  <p className="text-xs text-neutral-700 uppercase tracking-widest">Select a different filter or add items to this list</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-10">
                {listItems.map((item) => (
                  <div key={item.id} className="group relative">
                    <GlassCard
                      className="aspect-[3/4] p-0 border-white/5 overflow-hidden transition-all duration-700 group-hover:border-white/20 group-hover:shadow-[0_0_50px_-12px_rgba(0,0,0,0.8)]"
                      hoverEffect
                    >
                      {item.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.image}
                          alt={item.title}
                          className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-900 text-neutral-800 gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center">
                            <Filter size={20} className="opacity-10" />
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-30 text-center px-4">Artwork Unavailable</span>
                        </div>
                      )}

                      {/* Gradient Overlays */}
                      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 to-transparent opacity-40 group-hover:opacity-100 transition-opacity duration-500" />
                      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black via-black/60 to-transparent opacity-80 group-hover:opacity-100 transition-opacity duration-500" />

                      <div className="absolute inset-0 p-6 flex flex-col justify-end gap-3 z-20">
                        <div className="space-y-1 transform transition-transform duration-500 group-hover:translate-y-[-8px]">
                          <span className="inline-block px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-[9px] font-black uppercase tracking-[0.2em] text-neutral-400">
                            {mediaTypeLabels[item.mediaType]}
                          </span>
                          <h3 className="text-lg font-bold text-white leading-tight line-clamp-2 drop-shadow-lg">
                            {item.title}
                          </h3>
                        </div>
                      </div>

                      <div className="absolute top-4 right-4 z-30">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeItem(item.id, item.title);
                          }}
                          className="p-3 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 text-white/40 hover:text-red-400 hover:bg-red-500/20 hover:border-red-500/30 transition-all duration-300 shadow-xl opacity-0 group-hover:opacity-100 translate-y-[-10px] group-hover:translate-y-0"
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

          <div className="shrink-0 p-5 border-t border-white/5 bg-neutral-900/60 backdrop-blur-xl flex items-center justify-between gap-10">
            <div className="flex items-center gap-6">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.3em]">List Content</span>
                <span className="text-sm font-bold text-white tracking-widest">{listItems.length} Total Entries</span>
              </div>
              <div className="w-px h-10 bg-white/5" />
              <div className="flex -space-x-3">
                {listItems.slice(0, 5).map((item, i) => (
                  item.image && (
                    <div key={i} className="w-10 h-10 rounded-full border-2 border-neutral-900 overflow-hidden bg-neutral-800 shrink-0">
                      <Image src={item.image} alt="" width={40} height={40} className="w-full h-full object-cover opacity-60" />
                    </div>
                  )
                ))}
                {listItems.length > 5 && (
                  <div className="w-10 h-10 rounded-full border-2 border-neutral-900 bg-neutral-800 flex items-center justify-center text-[10px] font-bold text-neutral-500 shrink-0">
                    +{listItems.length - 5}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              {isEditingMetadata ? (
                <>
                  <button
                    onClick={() => {
                      setIsEditingMetadata(false);
                      setEditName(viewingList?.name || "");
                      setEditDescription(viewingList?.description || "");
                      setEditTypes(viewingList?.types || []);
                    }}
                    disabled={isSaving}
                    className="px-8 py-4 rounded-3xl text-neutral-400 text-[10px] font-bold uppercase tracking-[0.2em] hover:text-white transition-all hover:bg-white/5"
                  >
                    Discard Changes
                  </button>
                  <button
                    onClick={saveListEdits}
                    disabled={isSaving}
                    className="px-12 py-4 rounded-3xl bg-white text-black text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-neutral-200 transition-all disabled:opacity-50 shadow-[0_0_30px_rgba(255,255,255,0.1)] active:scale-95"
                  >
                    {isSaving ? "Saving..." : "Commit Changes"}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setViewingListId(null)}
                  className="px-12 py-4 rounded-3xl bg-neutral-800/50 text-white text-[10px] font-bold uppercase tracking-[0.2em] border border-white/10 hover:bg-neutral-800 transition-all backdrop-blur-md hover:border-white/20 active:scale-95"
                >
                  Close Manager
                </button>
              )}
            </div>
          </div>
        </div>

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

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="My lists"
        className="max-w-3xl bg-neutral-900/60"
      >
        <div className="flex flex-col gap-8">
          <div className="space-y-4">
            <div className="text-sm font-semibold text-white">Your lists</div>
            {!uid && (
              <div className="text-xs text-neutral-500">Sign in to sync</div>
            )}
            {uid && lists.length === 0 && (
              <div className="text-sm text-neutral-400">No lists yet.</div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {lists.map((list) => (
                <ListCard
                  key={list.id}
                  list={list}
                  onClick={() => setViewingListId(list.id)}
                  uid={uid}
                />
              ))}
            </div>
          </div>

          {pendingItem && uid && (
            <div className="rounded-2xl border border-white/5 bg-neutral-900/40 p-6 space-y-4">
              <div className="text-sm font-semibold text-white">Add to list</div>
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
                <div className="flex-1 w-full space-y-2">
                  <div className="text-xs text-neutral-400">Select list</div>
                  <select
                    value={selectedListId || ""}
                    onChange={(e) => setSelectedListId(e.target.value)}
                    className="w-full rounded-xl bg-neutral-800/50 border border-white/5 py-3 px-4 text-white placeholder-neutral-500 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20 transition-all appearance-none"
                  >
                    {lists.map(list => (
                      <option key={list.id} value={list.id} className="bg-neutral-900 text-white">
                        {list.name}
                      </option>
                    ))}
                  </select>
                  {selectedList ? (
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-500">
                      <span>Category: {listTypeLabels[selectedList.type]}</span>
                      {pendingListType && selectedList.type !== pendingListType ? (
                        <span className="text-amber-300">Different category</span>
                      ) : null}
                      {isCheckingItem ? <span>Checking…</span> : null}
                      {!isCheckingItem && isItemAlreadyInList ? (
                        <span className="text-amber-300">Already in list</span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto">
                  <button
                    onClick={addPendingToSelected}
                    disabled={
                      isSaving ||
                      !selectedListId ||
                      !selectedList ||
                      !pendingListType ||
                      selectedList.type !== pendingListType ||
                      isItemAlreadyInList
                    }
                    className={cn(
                      "w-full sm:w-auto px-6 py-3 rounded-xl bg-white/90 backdrop-blur-sm font-semibold text-neutral-950 transition-all hover:bg-white hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] active:scale-[0.98]",
                      (isSaving || !selectedListId || !selectedList || !pendingListType || selectedList.type !== pendingListType || isItemAlreadyInList)
                        ? "cursor-not-allowed opacity-70"
                        : ""
                    )}
                  >
                    {isSaving ? "Adding..." : `Add ${pendingItem.title}`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsNewListOpen(true)}
                    className="w-full sm:w-auto rounded-xl border border-white/10 bg-neutral-900/40 px-6 py-3 text-xs font-semibold text-neutral-200 transition-colors hover:bg-neutral-900/60 hover:text-white"
                  >
                    New list
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <button
              onClick={() => setIsNewListOpen(true)}
              className="group flex items-center gap-2 text-sm font-semibold text-neutral-400 hover:text-white transition-colors"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-neutral-600 group-hover:border-white transition-colors">
                +
              </span>
              Create a new list
            </button>
          </div>

          {error && <div className="text-sm text-red-400">{error}</div>}
          {info && <div className="text-sm text-emerald-300">{info}</div>}
        </div>
        <NewListModal
          isOpen={isNewListOpen}
          onClose={() => setIsNewListOpen(false)}
          defaultType={mediaType || null}
          onCreated={handleListCreated}
        />
      </Modal>
      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete list"
        className="max-w-md bg-neutral-900/70"
      >
        <div className="space-y-4 text-sm text-neutral-300">
          <div>
            Delete {deleteTarget?.name || "this list"}?
          </div>
          <div className="text-xs text-neutral-500">
            Keep Items removes the list but keeps entries in Other. Delete Items permanently removes entries.
          </div>
          {error ? <div className="text-sm text-red-400">{error}</div> : null}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => deleteList("keep")}
              disabled={isDeletingList}
              className={cn(
                "rounded-xl border border-white/10 bg-neutral-800/50 px-4 py-2 text-xs font-semibold text-neutral-200 transition-colors hover:bg-neutral-800",
                isDeletingList ? "cursor-not-allowed opacity-70" : "",
              )}
            >
              Keep Items
            </button>
            <button
              type="button"
              onClick={() => deleteList("delete")}
              disabled={isDeletingList}
              className={cn(
                "rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-200 transition-colors hover:bg-red-500/20",
                isDeletingList ? "cursor-not-allowed opacity-70" : "",
              )}
            >
              Delete Items
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function ListCard({
  list,
  onClick,
  uid,
}: {
  list: ListRow;
  onClick: () => void;
  uid: string | null;
}) {
  const [previewItems, setPreviewItems] = useState<string[]>([]);

  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, "users", uid, "lists", list.id, "items"),
      orderBy("addedAt", "desc"),
      limit(6),
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPreviewItems(
        snapshot.docs.map((d) => (d.data() as { title: string }).title),
      );
    });
    return () => unsubscribe();
  }, [uid, list.id]);

  return (
    <div className="rounded-2xl border border-white/5 bg-neutral-900/40 p-4 flex flex-col gap-4 transition-colors hover:bg-neutral-900/60">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-white truncate">{list.name}</div>
          <div className="flex flex-wrap gap-1">
            {list.types.map((type) => (
              <span key={type} className="rounded-full border border-white/10 bg-neutral-900/70 px-2 py-0.5 text-[10px] text-neutral-300">
                {listTypeLabels[type]}
              </span>
            ))}
          </div>
        </div>
        {list.description && (
          <div className="text-xs text-neutral-500 line-clamp-2">
            {list.description}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {previewItems.length > 0 ? (
          previewItems.map((title, i) => (
            <span
              key={i}
              className="rounded-full border border-white/10 bg-neutral-900/60 px-3 py-1 text-[10px] text-neutral-300"
            >
              {title}
            </span>
          ))
        ) : (
          <span className="text-xs text-neutral-600 italic">Empty list</span>
        )}
      </div>

      <button
        onClick={onClick}
        className="mt-auto w-full rounded-xl border border-white/10 bg-neutral-800/40 py-2 text-xs font-semibold text-neutral-200 transition-colors hover:bg-neutral-800 hover:text-white"
      >
        View list
      </button>
    </div>
  );
}
