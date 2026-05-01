// File: src/hooks/use-log-entry.ts
// Purpose: Hooks for log entry modal logic, including scroll locking, keyboard handling, and list management

// ─── React
import { useEffect, useRef, useState } from "react";

// ─── Firebase
import { collection, getDocs, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";

// ─── Internal — services
import { db } from "@/lib/firebase";

// ─── Internal — types
import type { EntryMediaType } from "@/types/log-entry";

// ─── Types
interface ListOption {
  id: string;
  name: string;
  type: EntryMediaType;
  types: EntryMediaType[];
}

// ─── Hook: useBodyScrollLock
/**
 * Locks the body scroll when the modal is active.
 */
export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev || "";
    };
  }, [active]);
}

// ─── Hook: useEscapeKey
/**
 * Triggers a callback when the Escape key is pressed.
 */
export function useEscapeKey(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, onClose]);
}

// ─── Hook: useLists
/**
 * Subscribes to the user's lists and provides them as options.
 */
export function useLists(uid: string | null, isOpen: boolean) {
  const [lists, setLists] = useState<ListOption[]>([]);

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
          ) as EntryMediaType;
          const types = (
            Array.isArray(data.types)
              ? data.types.filter((t): t is EntryMediaType =>
                  ["movie", "series", "anime", "manga", "game"].includes(t),
                )
              : [singleType]
          ) as EntryMediaType[];
          return { id: d.id, name: data.name || "Untitled List", type: singleType, types };
        }),
      );
    });
  }, [uid, isOpen]);

  return lists;
}

// ─── Hook: useInitialListIds
/**
 * Synchronizes the selected list IDs for an entry being edited.
 */
export function useInitialListIds(
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
