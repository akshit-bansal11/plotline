"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/auth-context";
import type { LoggableMedia } from "@/components/entry/log-entry-modal";

type ListRow = {
  id: string;
  name: string;
  description: string;
  updatedAt: number | null;
  createdAt: number | null;
};

type ListItemRow = {
  id: string;
  title: string;
  mediaType: "movie" | "series" | "anime" | "manga" | "game";
  source: "tmdb" | "omdb" | "mal";
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

const sourceLabels: Record<ListItemRow["source"], string> = {
  tmdb: "TMDB",
  omdb: "OMDb",
  mal: "MyAnimeList",
};

const toMillis = (value: unknown) => {
  if (!value) return null;
  if (typeof value === "number") return value;
  if (typeof value === "object" && value && "toMillis" in value && typeof (value as { toMillis: () => number }).toMillis === "function") {
    return (value as { toMillis: () => number }).toMillis();
  }
  return null;
};

export function ListsModal({
  isOpen,
  onClose,
  initialItem,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialItem?: LoggableMedia | null;
}) {
  const { user } = useAuth();
  const uid = user?.uid || null;

  const [lists, setLists] = useState<ListRow[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [items, setItems] = useState<ListItemRow[]>([]);

  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [renameValue, setRenameValue] = useState("");

  const pendingItem = useMemo(() => initialItem || null, [initialItem]);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setInfo(null);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (!uid) {
      setLists([]);
      setSelectedListId(null);
      return;
    }

    const listsQuery = query(collection(db, "users", uid, "lists"), orderBy("updatedAt", "desc"), limit(50));
    const unsubscribe = onSnapshot(
      listsQuery,
      (snapshot) => {
        const nextLists: ListRow[] = snapshot.docs.map((snap) => {
          const data = snap.data() as { name?: unknown; description?: unknown; updatedAt?: unknown; createdAt?: unknown };
          return {
            id: snap.id,
            name: typeof data.name === "string" ? data.name : "",
            description: typeof data.description === "string" ? data.description : "",
            updatedAt: toMillis(data.updatedAt),
            createdAt: toMillis(data.createdAt),
          };
        });
        setLists(nextLists);
        if (!selectedListId && nextLists.length > 0) {
          setSelectedListId(nextLists[0].id);
        }
        if (selectedListId && !nextLists.some((l) => l.id === selectedListId)) {
          setSelectedListId(nextLists[0]?.id || null);
        }
      },
      (err) => {
        const message = err instanceof Error ? err.message : "Failed to load lists.";
        setError(message);
        setLists([]);
        setSelectedListId(null);
      }
    );

    return () => unsubscribe();
  }, [isOpen, uid, selectedListId]);

  useEffect(() => {
    if (!isOpen) return;
    if (!uid || !selectedListId) {
      setItems([]);
      return;
    }

    const itemsQuery = query(
      collection(db, "users", uid, "lists", selectedListId, "items"),
      orderBy("addedAt", "desc"),
      limit(200)
    );
    const unsubscribe = onSnapshot(itemsQuery, (snapshot) => {
      const nextItems: ListItemRow[] = snapshot.docs.map((snap) => {
        const data = snap.data() as Partial<ListItemRow> & { addedAt?: unknown };
        const sourceValue = data.source === "tmdb" || data.source === "omdb" || data.source === "mal" ? data.source : "tmdb";
        const typeValue =
          data.mediaType === "movie" || data.mediaType === "series" || data.mediaType === "anime" || data.mediaType === "manga" || data.mediaType === "game"
            ? data.mediaType
            : "movie";
        return {
          id: snap.id,
          title: String(data.title || ""),
          mediaType: typeValue,
          source: sourceValue,
          externalId: String(data.externalId || ""),
          image: data.image ? String(data.image) : null,
          year: data.year ? String(data.year) : null,
          addedAt: toMillis(data.addedAt),
        };
      });
      setItems(nextItems);
    }, (err) => {
      const message = err instanceof Error ? err.message : "Failed to load list items.";
      setError(message);
      setItems([]);
    });

    return () => unsubscribe();
  }, [isOpen, uid, selectedListId]);

  const selectedList = useMemo(() => lists.find((l) => l.id === selectedListId) || null, [lists, selectedListId]);

  useEffect(() => {
    if (!isOpen) return;
    if (selectedList) setRenameValue(selectedList.name);
  }, [isOpen, selectedList]);

  const createList = async () => {
    setError(null);
    setInfo(null);
    if (!uid) {
      setError("Sign in to create lists.");
      return;
    }
    const name = newName.trim();
    if (!name) {
      setError("List name is required.");
      return;
    }
    if (name.length > 80) {
      setError("List name is too long.");
      return;
    }
    if (newDescription.trim().length > 280) {
      setError("Description is too long.");
      return;
    }

    setIsSaving(true);
    try {
      const docRef = await addDoc(collection(db, "users", uid, "lists"), {
        name,
        description: newDescription.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNewName("");
      setNewDescription("");
      setSelectedListId(docRef.id);
      setInfo("List created.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create list.");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteList = async (listId: string) => {
    if (!uid) return;
    setError(null);
    setInfo(null);
    setIsSaving(true);
    try {
      await deleteDoc(doc(db, "users", uid, "lists", listId));
      setInfo("List deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete list.");
    } finally {
      setIsSaving(false);
    }
  };

  const renameList = async () => {
    if (!uid || !selectedListId) return;
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
      await updateDoc(doc(db, "users", uid, "lists", selectedListId), {
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

  const addPendingToSelected = async () => {
    if (!uid || !selectedListId || !pendingItem) return;
    setError(null);
    setInfo(null);

    setIsSaving(true);
    try {
      await addDoc(collection(db, "users", uid, "lists", selectedListId, "items"), {
        title: pendingItem.title,
        mediaType: pendingItem.type,
        source: pendingItem.source,
        externalId: String(pendingItem.id),
        image: pendingItem.image || null,
        year: pendingItem.year || null,
        addedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "users", uid, "lists", selectedListId), { updatedAt: serverTimestamp() });
      setInfo("Added to list.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add item.");
    } finally {
      setIsSaving(false);
    }
  };

  const removeItem = async (itemId: string) => {
    if (!uid || !selectedListId) return;
    setError(null);
    setInfo(null);
    try {
      await deleteDoc(doc(db, "users", uid, "lists", selectedListId, "items", itemId));
      await updateDoc(doc(db, "users", uid, "lists", selectedListId), { updatedAt: serverTimestamp() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove item.");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="My lists" className="max-w-5xl bg-neutral-900/60">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/5 bg-neutral-900/40 p-4">
            <div className="text-sm font-semibold text-white">Create list</div>
            <div className="mt-3 space-y-3">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="List name"
                className="w-full rounded-xl bg-neutral-800/50 border border-white/5 py-3 px-4 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
              />
              <input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Description (optional)"
                className="w-full rounded-xl bg-neutral-800/50 border border-white/5 py-3 px-4 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
              />
              <button
                type="button"
                onClick={createList}
                disabled={isSaving}
                className={cn(
                  "w-full rounded-xl bg-white py-3 font-semibold text-neutral-950 transition-transform hover:scale-[1.02] active:scale-[0.98]",
                  isSaving ? "cursor-not-allowed opacity-70" : ""
                )}
              >
                Create
              </button>
            </div>
          </div>

          {pendingItem && (
            <div className="rounded-2xl border border-white/5 bg-neutral-900/40 p-4">
              <div className="text-xs font-medium text-neutral-400">Ready to add</div>
              <div className="mt-2 text-sm font-semibold text-white">{pendingItem.title}</div>
              <div className="mt-1 text-xs text-neutral-500">
                {(pendingItem.year ? `${pendingItem.year} • ` : "") + mediaTypeLabels[pendingItem.type]} • {sourceLabels[pendingItem.source]}
              </div>
              <button
                type="button"
                onClick={addPendingToSelected}
                disabled={!uid || !selectedListId || isSaving}
                className={cn(
                  "mt-3 w-full rounded-xl border border-white/10 bg-neutral-800/40 py-3 text-sm font-semibold text-neutral-200 transition-colors hover:bg-neutral-800 hover:text-white",
                  !uid || !selectedListId || isSaving ? "cursor-not-allowed opacity-70" : ""
                )}
              >
                Add to selected list
              </button>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-white">Your lists</div>
              {!uid && <div className="text-xs text-neutral-500">Sign in to sync</div>}
            </div>

            {uid && lists.length === 0 && <div className="text-sm text-neutral-400">No lists yet.</div>}

            <div className="space-y-2">
              {lists.map((list) => {
                const active = list.id === selectedListId;
                return (
                  <button
                    key={list.id}
                    type="button"
                    onClick={() => setSelectedListId(list.id)}
                    className={cn(
                      "w-full rounded-2xl border p-3 text-left transition-colors",
                      active ? "border-white/20 bg-white/5" : "border-white/5 bg-neutral-900/40 hover:bg-white/5"
                    )}
                  >
                    <div className="text-sm font-semibold text-white truncate">{list.name}</div>
                    {list.description ? <div className="mt-1 text-xs text-neutral-500 line-clamp-2">{list.description}</div> : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-white/5 bg-neutral-900/40 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white truncate">{selectedList?.name || "Select a list"}</div>
                {selectedList?.description ? (
                  <div className="mt-1 text-xs text-neutral-500">{selectedList.description}</div>
                ) : null}
              </div>

              {selectedListId && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => deleteList(selectedListId)}
                    disabled={isSaving}
                    className={cn(
                      "rounded-full border border-white/10 bg-neutral-800/40 px-4 py-2 text-xs font-semibold text-neutral-200 transition-colors hover:bg-neutral-800 hover:text-white",
                      isSaving ? "cursor-not-allowed opacity-70" : ""
                    )}
                  >
                    Delete list
                  </button>
                </div>
              )}
            </div>

            {selectedListId && (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                <input
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  placeholder="Rename list"
                  className="w-full rounded-xl bg-neutral-800/50 border border-white/5 py-3 px-4 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
                />
                <button
                  type="button"
                  onClick={renameList}
                  disabled={!uid || isSaving}
                  className={cn(
                    "rounded-xl bg-white px-5 py-3 text-sm font-semibold text-neutral-950 transition-transform hover:scale-[1.02] active:scale-[0.98]",
                    !uid || isSaving ? "cursor-not-allowed opacity-70" : ""
                  )}
                >
                  Save
                </button>
              </div>
            )}
          </div>

          {error && <div className="text-sm text-red-400">{error}</div>}
          {info && <div className="text-sm text-emerald-300">{info}</div>}

          {selectedListId && (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-white">Items</div>
              {uid && items.length === 0 && <div className="text-sm text-neutral-400">No items yet.</div>}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-white/5 bg-neutral-900/40 p-4">
                    <div className="text-sm font-semibold text-white line-clamp-2">{item.title}</div>
                    <div className="mt-1 text-xs text-neutral-500">
                      {(item.year ? `${item.year} • ` : "") + mediaTypeLabels[item.mediaType]} • {sourceLabels[item.source]}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="mt-3 w-full rounded-xl border border-white/10 bg-neutral-800/40 py-2 text-xs font-semibold text-neutral-200 transition-colors hover:bg-neutral-800 hover:text-white"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
