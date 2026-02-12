"use client";

import { useEffect, useMemo, useState } from "react";
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
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/auth-context";
import type { LoggableMedia } from "@/components/entry/log-entry-modal";
import { NewListModal } from "@/components/lists/new-list-modal";

type EntryMediaType = "movie" | "series" | "anime" | "manga" | "game";

type ListRow = {
  id: string;
  name: string;
  description: string;
  type: EntryMediaType;
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

  const [renameValue, setRenameValue] = useState("");
  const [isNewListOpen, setIsNewListOpen] = useState(startCreating);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [isDeletingList, setIsDeletingList] = useState(false);
  const [pendingDeleteListId, setPendingDeleteListId] = useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editType, setEditType] = useState<EntryMediaType>("movie");
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
    setIsEditOpen(Boolean(initialEditListId));
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
            updatedAt?: unknown;
            createdAt?: unknown;
          };
          return {
            id: snap.id,
            name: typeof data.name === "string" ? data.name : "",
            description:
              typeof data.description === "string" ? data.description : "",
            type: (data.type as EntryMediaType) || "movie",
            updatedAt: toMillis(data.updatedAt),
            createdAt: toMillis(data.createdAt),
          };
        });
        
        // Filter lists by media type if specified
        const filteredLists = mediaType ? nextLists.filter(list => list.type === mediaType) : nextLists;
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
  }, [isOpen, uid, selectedListId]);

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
    if (!isOpen) return;
    if (viewingList) setRenameValue(viewingList.name);
  }, [isOpen, viewingList]);

  useEffect(() => {
    if (!viewingListId) {
      setIsEditOpen(false);
      setDeleteItemTarget(null);
    }
  }, [viewingListId]);

  useEffect(() => {
    if (!isOpen || !viewingList) return;
    setEditName(viewingList.name);
    setEditDescription(viewingList.description || "");
    setEditType(viewingList.type);
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

  const handleListCreated = (list: { id: string; name: string; type: EntryMediaType; description: string }) => {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete list.");
    } finally {
      setIsDeletingList(false);
    }
  };

  const renameList = async () => {
    if (!uid || !viewingListId) return;
    setError(null);
    setInfo(null);
    const name = renameValue.trim();
    if (!name) {
      setError("List name is required.");
      return;
    }
    if (name.length > 80) {
      setError("List name is too long.");
      return;
    }

    setIsSaving(true);
    try {
      await updateDoc(doc(db, "users", uid, "lists", viewingListId), {
        name,
        updatedAt: serverTimestamp(),
      });
      setInfo("Saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename list.");
    } finally {
      setIsSaving(false);
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
    if (!editType) {
      setError("Select a category.");
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
        type: editType,
        updatedAt: serverTimestamp(),
      });
      setRenameValue(name);
      setInfo("List updated.");
      setIsEditOpen(false);
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
    if (selectedList.type !== pendingListType) {
      setError(`This list only accepts ${listTypeLabels[selectedList.type]} items.`);
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
    return (
      <>
        <Modal
          isOpen={isOpen}
          onClose={onClose}
          title="List Details"
          className="max-w-5xl bg-neutral-900/60"
        >
          <div className="space-y-4">
            <button
              onClick={() => setViewingListId(null)}
              className="text-sm text-neutral-400 hover:text-white transition-colors"
            >
              ← Back to all lists
            </button>

          <div className="rounded-2xl border border-white/5 bg-neutral-900/40 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white truncate">
                  {viewingList?.name || "List"}
                </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-neutral-400">
                    {viewingList?.type ? (
                      <span className="rounded-full border border-white/10 bg-neutral-900/60 px-3 py-1">
                        Category: {listTypeLabels[viewingList.type]}
                      </span>
                    ) : null}
                  </div>
                {viewingList?.description ? (
                  <div className="mt-1 text-xs text-neutral-500">
                    {viewingList.description}
                  </div>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(true)}
                  disabled={isSaving}
                  className={cn(
                    "rounded-full border border-white/10 bg-neutral-800/40 px-4 py-2 text-xs font-semibold text-neutral-200 transition-colors hover:bg-neutral-800 hover:text-white",
                    isSaving ? "cursor-not-allowed opacity-70" : "",
                  )}
                  aria-label="Edit list"
                >
                  Edit list
                </button>
                <button
                  type="button"
                  onClick={() => viewingList && setDeleteTarget({ id: viewingList.id, name: viewingList.name })}
                  disabled={isSaving || isDeletingList}
                  className={cn(
                    "rounded-full border border-white/10 bg-neutral-800/40 px-4 py-2 text-xs font-semibold text-neutral-200 transition-colors hover:bg-neutral-800 hover:text-white",
                    isSaving || isDeletingList ? "cursor-not-allowed opacity-70" : "",
                  )}
                  aria-label="Delete list"
                >
                  Delete list
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
              <input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder="Rename list"
                className="w-full rounded-xl bg-neutral-800/50 border border-white/5 py-3 px-4 text-white placeholder-neutral-500 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20 transition-all"
              />
              <button
                type="button"
                onClick={renameList}
                disabled={!uid || isSaving}
                className={cn(
                  "rounded-xl bg-white/90 backdrop-blur-sm px-5 py-3 text-sm font-semibold text-neutral-950 transition-all hover:bg-white hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] active:scale-[0.98]",
                  !uid || isSaving ? "cursor-not-allowed opacity-70" : "",
                )}
              >
                Save
              </button>
            </div>
          </div>

          {error && <div className="text-sm text-red-400">{error}</div>}
          {info && <div className="text-sm text-emerald-300">{info}</div>}

          <div className="space-y-2">
            <div className="text-sm font-semibold text-white">Items</div>
            {uid && items.length === 0 && (
              <div className="text-sm text-neutral-400">No items yet.</div>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-white/5 bg-neutral-900/40 p-4"
                >
                  <div className="text-sm font-semibold text-white line-clamp-2">
                    {item.title}
                  </div>
                  <div className="mt-1 text-xs text-neutral-500">
                    {(item.year ? `${item.year} • ` : "") +
                      mediaTypeLabels[item.mediaType]}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id, item.title)}
                    className="mt-3 w-full rounded-xl border border-white/10 bg-neutral-800/40 py-2 text-xs font-semibold text-neutral-200 transition-colors hover:bg-neutral-800 hover:text-white"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
          </div>
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
        <Modal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          title="Edit list"
          className="max-w-5xl bg-neutral-900/70"
        >
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="text-xs font-medium text-neutral-400">List name</div>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={80}
                  className="w-full rounded-xl bg-neutral-800/50 border border-white/5 py-3 px-4 text-white placeholder-neutral-500 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20 transition-all"
                />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium text-neutral-400">Category</div>
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value as EntryMediaType)}
                  className="w-full rounded-xl bg-neutral-800/50 border border-white/5 py-3 px-4 text-white focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20 transition-all"
                >
                  {(["movie", "series", "anime", "manga", "game"] as EntryMediaType[]).map((value) => (
                    <option key={value} value={value} className="bg-neutral-900 text-white">
                      {listTypeLabels[value]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium text-neutral-400">Description</div>
                  <div className="text-xs text-neutral-500">{editDescription.length}/250</div>
                </div>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={4}
                  maxLength={250}
                  className="w-full resize-none rounded-xl bg-neutral-800/50 border border-white/5 py-3 px-4 text-white placeholder-neutral-500 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20 transition-all"
                />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium text-neutral-400">Items</div>
                {items.length === 0 ? (
                  <div className="text-sm text-neutral-500">No items yet.</div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {items.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-white/5 bg-neutral-900/40 p-4">
                        <div className="text-sm font-semibold text-white line-clamp-2">
                          {item.title}
                        </div>
                        <div className="mt-1 text-xs text-neutral-500">
                          {(item.year ? `${item.year} • ` : "") + mediaTypeLabels[item.mediaType]}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id, item.title)}
                          className="mt-3 w-full rounded-xl border border-white/10 bg-neutral-800/40 py-2 text-xs font-semibold text-neutral-200 transition-colors hover:bg-neutral-800 hover:text-white"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {error && <div className="text-sm text-red-400">{error}</div>}
              {info && <div className="text-sm text-emerald-300">{info}</div>}
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  disabled={isSaving}
                  className={cn(
                    "rounded-xl border border-white/10 bg-neutral-800/50 px-4 py-2 text-xs font-semibold text-neutral-200 transition-colors hover:bg-neutral-800",
                    isSaving ? "cursor-not-allowed opacity-70" : "",
                  )}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveListEdits}
                  disabled={isSaving}
                  className={cn(
                    "rounded-xl bg-white/90 px-4 py-2 text-xs font-semibold text-neutral-950 transition-colors hover:bg-white",
                    isSaving ? "cursor-not-allowed opacity-70" : "",
                  )}
                >
                  {isSaving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </div>
            <div className="space-y-4">
              <div className="text-sm font-semibold text-white">Preview</div>
              <div className="rounded-2xl border border-white/5 bg-neutral-900/40 p-4">
                <div className="text-sm font-semibold text-white truncate">
                  {editName.trim() || viewingList?.name || "List"}
                </div>
                <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-neutral-400">
                  <span className="rounded-full border border-white/10 bg-neutral-900/60 px-3 py-1">
                    Category: {listTypeLabels[editType]}
                  </span>
                </div>
                {editDescription.trim() ? (
                  <div className="mt-1 text-xs text-neutral-500">{editDescription.trim()}</div>
                ) : null}
              </div>
              <div className="rounded-2xl border border-white/5 bg-neutral-900/40 p-4">
                <div className="text-xs text-neutral-500">{items.length} items</div>
                {items.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {items.slice(0, 6).map((item) => (
                      <span
                        key={item.id}
                        className="rounded-full border border-white/10 bg-neutral-900/60 px-3 py-1 text-[10px] text-neutral-300"
                      >
                        {item.title}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </Modal>
        <Modal
          isOpen={Boolean(deleteItemTarget)}
          onClose={() => setDeleteItemTarget(null)}
          title="Remove item"
          className="max-w-md bg-neutral-900/70"
        >
          <div className="space-y-4 text-sm text-neutral-300">
            <div>
              Remove {deleteItemTarget?.title || "this item"} from the list?
            </div>
            {error ? <div className="text-sm text-red-400">{error}</div> : null}
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setDeleteItemTarget(null)}
                disabled={isSaving}
                className={cn(
                  "rounded-xl border border-white/10 bg-neutral-800/50 px-4 py-2 text-xs font-semibold text-neutral-200 transition-colors hover:bg-neutral-800",
                  isSaving ? "cursor-not-allowed opacity-70" : "",
                )}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRemoveItem}
                disabled={isSaving}
                className={cn(
                  "rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-200 transition-colors hover:bg-red-500/20",
                  isSaving ? "cursor-not-allowed opacity-70" : "",
                )}
              >
                {isSaving ? "Removing..." : "Remove"}
              </button>
            </div>
          </div>
        </Modal>
      </>
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
          <span className="rounded-full border border-white/10 bg-neutral-900/70 px-3 py-1 text-[10px] text-neutral-300">
            {listTypeLabels[list.type]}
          </span>
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
